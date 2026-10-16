# 11 · 强化学习、奖励设计与 Sim2Real

> 阅读目标：从 MDP 推出策略梯度、优势估计与 PPO / SAC 的目标；理解奖励整形何时不改变最优策略；把仿真训练迁移到实机时，分清域随机化、系统辨识、特权教师和在线适应各自解决什么问题。

## 1. 问题与符号

具身任务常见三种学习信号：演示（模仿学习，见 06）、奖励（强化学习）、偏好或语言反馈。RL 适合“能定义回报、可大量试错”的问题，例如腿足行走、灵巧手转物体、插孔微调；在实机直接试错昂贵且危险，所以通常在仿真中训练再迁移。

|符号|含义|约定|
|---|---|---|
|$\mathcal M=(\mathcal S,\mathcal A,P,r,\gamma,\rho_0)$|马尔可夫决策过程|$P(s'\mid s,a)$ 转移；$\rho_0$ 初始分布|
|$\tau=(s_0,a_0,r_0,s_1,\dots)$|轨迹|$r_t=r(s_t,a_t)$|
|$\pi_\theta(a\mid s)$|随机策略|连续动作常用高斯，离散用 softmax|
|$V^\pi,Q^\pi,A^\pi$|状态价值、动作价值、优势|$A^\pi=Q^\pi-V^\pi$|
|$G_t=\sum_{k\ge0}\gamma^kr_{t+k}$|折扣回报|$0\le\gamma<1$|
|$\delta_t$|TD 残差|$r_t+\gamma V(s_{t+1})-V(s_t)$|
|$\rho_t(\theta)$|新旧策略概率比|$\pi_\theta(a_t\mid s_t)/\pi_{old}(a_t\mid s_t)$|
|$\xi$|仿真物理参数|质量、摩擦、延迟、增益等|
|$o_t,x_t^{priv}$|可部署观测、仿真特权状态|特权状态实机不可得|

目标：$J(\theta)=\mathbb E_{\tau\sim\pi_\theta}\left[\sum_t\gamma^tr_t\right]$。部分可观测时状态 s 换成观测历史，策略常带 RNN / 历史窗口。

## 2. 策略梯度：从对数导数技巧到优势

<details class="derivation" open><summary>推导 1 · 策略梯度定理与基线不引入偏差</summary>

轨迹概率 $p_\theta(\tau)=\rho_0(s_0)\prod_t\pi_\theta(a_t\mid s_t)P(s_{t+1}\mid s_t,a_t)$。环境转移不依赖 θ，因此：

$$\nabla_\theta\log p_\theta(\tau)=\sum_t\nabla_\theta\log\pi_\theta(a_t\mid s_t).\tag{11.1}$$

用 $\nabla p=p\nabla\log p$：

$$\nabla_\theta J=\mathbb E_\tau\left[R(\tau)\nabla_\theta\log p_\theta(\tau)\right]=\mathbb E_\tau\left[\sum_t\nabla_\theta\log\pi_\theta(a_t\mid s_t)\,G_t\right].\tag{11.2}$$

第二个等号用了因果性：t 时刻的动作不影响 t 之前的奖励，那些项期望为零，只保留 reward-to-go。再减去只依赖状态的基线 b(s)：

$$\mathbb E_{a\sim\pi}\left[\nabla_\theta\log\pi_\theta(a\mid s)\,b(s)\right]=b(s)\nabla_\theta\int\pi_\theta(a\mid s)da=b(s)\nabla_\theta1=0.\tag{11.3}$$

所以把 $G_t$ 换成 $G_t-V(s_t)$ 或优势估计 $\hat A_t$ 不改变期望梯度，只降低方差。基线若依赖当前动作 a，就不再满足上式。

</details>

## 3. GAE：在偏差与方差之间插值

<details class="derivation" open><summary>推导 2 · 广义优势估计的指数加权</summary>

k 步优势估计 $\hat A_t^{(k)}=\sum_{l=0}^{k-1}\gamma^lr_{t+l}+\gamma^kV(s_{t+k})-V(s_t)$。把 TD 残差逐项相加可验证 $\hat A_t^{(k)}=\sum_{l=0}^{k-1}\gamma^l\delta_{t+l}$（中间的 V 项望远镜抵消）。对所有 k 用权重 $(1-\lambda)\lambda^{k-1}$ 平均：

$$\hat A_t^{GAE(\gamma,\lambda)}=(1-\lambda)\sum_{k\ge1}\lambda^{k-1}\hat A_t^{(k)}=\sum_{l\ge0}(\gamma\lambda)^l\delta_{t+l}.\tag{11.4}$$

λ=0 只用一步 TD（低方差、受价值误差影响大）；λ=1 退化为蒙特卡洛回报减基线（无偏但方差大）。实现时从轨迹末端反向递推 $\hat A_t=\delta_t+\gamma\lambda(1-d_t)\hat A_{t+1}$，$d_t$ 为终止标志。时间截断（time-limit）不是真正终止，应对 $s_{t+1}$ 做价值自举，否则会把“超时”误学成“失败”。

</details>

## 4. PPO：限制每次更新的步幅

直接用式 (11.2) 做大步更新，新策略访问的状态分布与采样分布差别大，估计失效。PPO 用裁剪的替代目标：

$$L^{CLIP}(\theta)=\mathbb E_t\left[\min\left(\rho_t\hat A_t,\ \operatorname{clip}(\rho_t,1-\epsilon,1+\epsilon)\hat A_t\right)\right].\tag{11.5}$$

<details class="derivation" open><summary>推导 3 · 裁剪如何形成“悲观下界”</summary>

在旧策略附近，重要性采样给出 $J(\theta)-J(\theta_{old})\approx\mathbb E_{s,a\sim\pi_{old}}[\rho\hat A]$，这个近似只在 ρ 接近 1 时可靠。分两种情况：

- $\hat A>0$：希望增大 ρ；当 $\rho>1+\epsilon$ 时 min 取裁剪值 $(1+\epsilon)\hat A$，梯度为零，不再继续推高。
- $\hat A<0$：希望减小 ρ；当 $\rho<1-\epsilon$ 时取 $(1-\epsilon)\hat A$，同样停止。

而“变坏方向”（$\hat A>0$ 但 ρ<1）不被裁剪，保留完整惩罚。因此目标是未裁剪目标的下界。数值例：$\epsilon=0.2,\hat A=2$，若 ρ=1.5，裁剪项为 2.4，未裁剪为 3.0，取 2.4 且对 θ 无梯度。

完整损失通常为 $-L^{CLIP}+c_vL_V-c_e\mathcal H[\pi_\theta]$，并对优势做批内标准化。PPO 是在线（on-policy）方法：样本只用于少数几个 epoch，样本效率低，但仿真可大规模并行（数千个环境）来弥补。

</details>

## 5. SAC：最大熵与离线策略重用

SAC 优化带熵奖励的目标 $J=\sum_t\mathbb E[r_t+\alpha\mathcal H(\pi(\cdot\mid s_t))]$，鼓励探索，并可复用经验回放中的旧样本。

<details class="derivation" open><summary>推导 4 · 软 Bellman 备份与温度自适应</summary>

软价值 $V(s)=\mathbb E_{a\sim\pi}[Q(s,a)-\alpha\log\pi(a\mid s)]$，软 Q 目标：

$$y=r+\gamma(1-d)\left(\min_{j=1,2}Q_{\bar\phi_j}(s',a')-\alpha\log\pi_\theta(a'\mid s')\right),\quad a'\sim\pi_\theta(\cdot\mid s').\tag{11.6}$$

取两个目标网络的最小值抑制过估计。策略改进最小化 $\mathbb E_s D_{KL}(\pi(\cdot\mid s)\,\|\,\exp(Q(s,\cdot)/\alpha)/Z(s))$，展开去掉与 π 无关的 log Z 得：

$$L_\pi=\mathbb E_{s,\epsilon}\left[\alpha\log\pi_\theta(a_\theta\mid s)-Q(s,a_\theta)\right],\quad a_\theta=\tanh(\mu_\theta(s)+\sigma_\theta(s)\odot\epsilon).\tag{11.7}$$

重参数化让梯度穿过采样。tanh 压缩改变密度，需加 $-\sum_i\log(1-\tanh^2u_i)$ 修正。温度 α 通过约束平均熵不低于目标 $\bar{\mathcal H}$（常取 $-d_a$）自动调节：$L_\alpha=\mathbb E[-\alpha(\log\pi(a\mid s)+\bar{\mathcal H})]$。

</details>

|方法|数据|典型具身用途|注意|
|---|---|---|---|
|PPO|在线、并行仿真|腿足 / 人形行走、灵巧手|需要大量环境步；对奖励尺度敏感|
|SAC / TD3|离线策略、回放|实机微调、低维操作|高维图像需表征学习或数据增强|
|离线 RL|固定数据集|利用历史日志|要抑制对未见动作的 Q 外推|
|RL 微调策略|演示初始化 + 奖励|VLA / DP 残差修正|与模仿目标的权衡需正则|

离线 RL 的核心问题是 $\max_aQ(s,a)$ 会选中数据未覆盖、Q 被高估的动作。CQL 在 TD 损失上加 $\alpha\,\mathbb E_s[\log\sum_a\exp Q(s,a)-\mathbb E_{a\sim D}Q(s,a)]$，压低分布外动作的 Q 值。

## 6. 奖励设计：稀疏、稠密与势函数整形

稀疏奖励（成功 +1）易定义但探索难；稠密奖励（距离、朝向、能耗）好学但可能被“钻空子”（reward hacking），如机器人学会抖动接近目标而不完成抓取。

<details class="derivation" open><summary>推导 5 · 势函数整形保持最优策略</summary>

令新奖励 $r'(s,a,s')=r(s,a,s')+F(s,s')$，取 $F=\gamma\Phi(s')-\Phi(s)$。沿任意轨迹求折扣和：

$$\sum_{t=0}^{T-1}\gamma^tF(s_t,s_{t+1})=\sum_{t=0}^{T-1}\left(\gamma^{t+1}\Phi(s_{t+1})-\gamma^t\Phi(s_t)\right)=\gamma^T\Phi(s_T)-\Phi(s_0).\tag{11.8}$$

望远镜求和后只剩端点项。T→∞ 且 Φ 有界时第一项趋零，所以 $Q'^\pi(s,a)=Q^\pi(s,a)-\Phi(s)$ 对所有策略成立，按 a 取 argmax 不变，最优策略不变（Ng, Harada & Russell, 1999）。例如取 $\Phi(s)=-\|p_{ee}-p_{goal}\|$ 引导接近。任意加一个“距离越近奖励越多”的项则没有这个保证。

</details>

腿足行走的典型奖励由多项加权：跟踪指令速度 $\exp(-\|v_{xy}-v^{cmd}\|^2/\sigma)$、惩罚关节力矩 / 加速度 / 动作变化率、脚部滑动、身体姿态偏离、非足部接触。权重要随单位归一，并在训练日志中分项记录，便于发现哪一项主导了行为。

## 7. Sim2Real：差距来自哪里

```mermaid
flowchart LR
 R[随机化物理与外观参数 xi] --> S[并行仿真环境 x 4096]
 S --> T[特权教师策略: 地形 / 摩擦 / 接触真值]
 T --> D[蒸馏: 学生只看可部署观测历史]
 S --> D
 D --> A[适应模块: 从历史估计隐变量 z]
 A --> P[部署策略 50 Hz 输出关节目标]
 P --> C[PD 控制器 1 kHz]
 C --> H[实机]
 H --> L[日志 / 失败案例 / 系统辨识]
 L --> R
```

|差距来源|例子|常用对策|
|---|---|---|
|动力学|质量、摩擦、电机力矩曲线、齿隙|系统辨识、动力学随机化、执行器网络|
|时延与频率|传感 / 通信 / 推理延迟、丢帧|随机化延迟、动作历史输入、低通|
|感知|渲染与真实图像、深度噪声|视觉随机化、深度噪声模型、用本体感知为主|
|接触|软体、碰撞参数、穿透|保守接触参数、力传感、实机微调|
|状态估计|仿真用真值，实机靠滤波|训练时加入估计误差，或学生学估计器|

<details class="derivation" open><summary>推导 6 · 域随机化的目标与“特权教师—学生”蒸馏</summary>

域随机化把仿真参数视为随机变量，训练对整个分布期望最优的策略：

$$\theta^*=\arg\max_\theta\ \mathbb E_{\xi\sim p(\xi)}\left[J_\xi(\theta)\right].\tag{11.9}$$

若真实参数 $\xi_{real}$ 落在 p(ξ) 支撑内且策略能从历史推断 ξ，迁移更稳；范围过宽会让策略过度保守。用无记忆策略时，最优解只能对 ξ 取平均行为；带历史的策略可以隐式识别 ξ，这就是在线适应。

特权教师 $\pi_T(a\mid o_t,x_t^{priv})$ 先用 RL 训练；学生 $\pi_S(a\mid o_{t-H:t})$ 在学生自己访问的状态上模仿教师（DAgger 式，避免分布偏移）：

$$L_{distill}=\mathbb E_{s\sim d_{\pi_S}}\left\|\pi_S(o_{t-H:t})-\pi_T(o_t,x_t^{priv})\right\|^2.\tag{11.10}$$

RMA 类方法把教师的环境编码 $z=\mu(\xi)$ 作为回归目标，让学生的适应模块从状态—动作历史估计 $\hat z=\phi(o_{t-H:t},a_{t-H:t-1})$。非对称 Actor-Critic 则只让价值网络使用特权信息，策略仍只看可部署观测。

</details>

动作接口直接影响迁移：输出关节目标位置再由 PD 跟踪 $\tau=K_p(q^*-q)-K_d\dot q$，比直接输出力矩更稳，但 $K_p,K_d$ 也成为需随机化或辨识的参数。

## 8. 实践清单与局限

1. 先在仿真中复现实机传感频率、延迟和动作限幅；单位与坐标系与实机驱动完全一致。
2. 记录随机化范围和种子，至少 3–5 个随机种子报告均值与方差。
3. 训练曲线高不代表能迁移；保留未参与训练的随机化参数做 held-out 测试。
4. 实机部署先限速限力、悬吊或软限位，再逐级放开；记录失败视频与原始传感日志。
5. 奖励项和课程（地形难度递增）一起调；课程过快会导致策略崩溃。

局限：RL 的样本效率和奖励设计成本仍高；仿真难以准确模拟可变形物体、液体和复杂摩擦接触；随机化本身不保证安全，安全约束需要独立的过滤或约束优化。

来源：[Sutton & Barto《Reinforcement Learning》](http://incompleteideas.net/book/the-book-2nd.html)、[GAE](https://arxiv.org/abs/1506.02438)、[PPO](https://arxiv.org/abs/1707.06347)、[SAC](https://arxiv.org/abs/1801.01290)、[CQL](https://arxiv.org/abs/2006.04779)、[Domain Randomization](https://arxiv.org/abs/1703.06907)、[Asymmetric Actor-Critic](https://arxiv.org/abs/1710.06542)、[RMA](https://arxiv.org/abs/2107.04034)、[ANYmal 复杂地形行走](https://arxiv.org/abs/2010.11251)；势函数整形见 Ng, Harada & Russell (ICML 1999)。
