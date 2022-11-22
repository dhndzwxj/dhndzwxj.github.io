// 本文档旨在介绍匹配方法，配合使用的数据是关于美国1970年代中期的某个职业培训项目。

use lalonde_data_psid.dta, clear

// 实验组的干预前结果和调查数据控制组的干预前结果有很大差异。

tabstat re75, by(treat) stats(n mean sd max min)
histogram re75, percent by(treat)

// 估计倾向得分。基于逐步回归方法搜索函数设定(Imbens, 2015)。
// 一次项的临界值c_lin=1; 二次项的临界值c_qua=2.71

// 先确定哪些一次项应该加入。

logit treat re74 re75 u74 u75
estimates store a
foreach var in black hispanic age married nodegree edu {
	di ""
	di "`var'"
	qui logit treat re74 re75 u74 u75 `var'
	lrtest a
}

logit treat re74 re75 u74 u75 married
estimates store a
foreach var in black hispanic age nodegree edu {
	di ""
	di "`var'"
	qui logit treat re74 re75 u74 u75 married `var'
	lrtest a
}

logit treat re74 re75 u74 u75 married black
estimates store a
foreach var in hispanic age nodegree edu {
	di ""
	di "`var'"
	qui logit treat re74 re75 u74 u75 married black `var'
	lrtest a
}

logit treat re74 re75 u74 u75 married black age
estimates store a
foreach var in hispanic nodegree edu {
	di ""
	di "`var'"
	qui logit treat re74 re75 u74 u75 married black age `var'
	lrtest a
}

logit treat re74 re75 u74 u75 married black age hispanic
estimates store a
foreach var in nodegree edu {
	di ""
	di "`var'"
	qui logit treat re74 re75 u74 u75 married black age hispanic `var'
	lrtest a
}

logit treat re74 re75 u74 u75 married black age hispanic nodegree
estimates store a
qui logit treat re74 re75 u74 u75 married black age hispanic nodegree edu
lrtest a

// 构造所有的二次项，再确定那些应该加入。
// 注意，其中一些二次项是冗余的，
// 例如，r74*u74恒等于零，而虚拟变量的平方项与一次项恒等。

gen r74s=re74^2/10e6
gen r74r75=re74*re75/10e6
// gen r74u74=re74*u74
gen r74u75=re74*u75
gen r74n=re74*nodegree
gen r74h=re74*hispanic
gen r74e=re74*edu
gen r75s=re75^2/10e6
gen r75u74=re75*u74
// gen r75u75=re75*u75
gen r75n=re75*nodegree
gen r75h=re75*hispanic
gen r75e=re75*edu
// gen u74s=u74^2
gen u74u75=u74*u75
gen u74n=u74*nodegree
gen u74h=u74*hispanic
gen u74e=u74*edu
// gen u75s=u75^2
gen u75n=u75*nodegree
gen u75h=u75*hispanic
gen u75e=u75*edu
// gen ns=nodegree^2
gen nh=nodegree*hispanic
gen ne=nodegree*edu
// gen hs=hispanic^2
gen he=hispanic*edu
gen es=edu^2

logit treat re74 re75 u74 u75 married black age hispanic nodegree
estimates store a
foreach var of varlist r74s-es {
	di ""
	di "`var'"
	qui logit treat re74 re75 u74 u75 married black age hispanic nodegree `var'
	lrtest a
}

logit treat re74 re75 u74 u75 married black age hispanic nodegree u74u75
estimates store a
foreach var of varlist r74s-r75e u74n-es {
	di ""
	di "`var'"
	qui logit treat re74 re75 u74 u75 married black age hispanic nodegree u74u75 `var'
	lrtest a
}

// 展示最终确定的函数形式及估计结果，读入内存，并手动计算倾向得分。

estimates replay a
estimates restore a
predict ps0
tabstat ps0, by(treat) stats(n mean sd min max)

// 删截样本：将倾向得分过高或过低的观测值删去
// （否则有可能匹配效果不理想，出现不合理的估计结果）。

gen msample1=(ps0>=.1 & ps0<=.9)
tab treat if msample1

qui sum ps0 if treat==0
scalar psmax=r(max)
qui sum ps0 if treat==1
scalar psmin=r(min)
gen msample2=(ps0>=psmin & ps0<=psmax)
tab treat if msample2

// 协变量匹配（有必要在删截后的样本中进行，对于倾向得分匹配也是如此）
// 估计ATT，以msample1为例
// 注意，不要把用于协变量匹配的协变量和用于倾向得分匹配的协变量混淆。
// 进行协变量匹配时，无须加入新生成的二次项。

// 官方命令teffects nnmatch和用户自编命令nnmatch的
// 平均处理效应估计完全一致，标准误有所差异。
// 两个命令的默认选项有所不同，以下两行表示协变量的距离指标为马氏距离
// （即用方差-协方差矩阵的逆加权的距离平方和）。

teffects nnmatch (re78 age-re75 u74 u75) (treat) if msample1, atet
nnmatch re78 treat age-re75 u74 u75 if msample1, metric(maha) robusth(2) tc(att)

// 以下两行表示用于偏误修正的协变量为干预前结果。

teffects nnmatch (re78 age-re75 u74 u75) (treat) if msample1, atet biasadj(re74 re75 u74 u75)
nnmatch re78 treat age-re75 u74 u75 if msample1, metric(maha) robusth(2) tc(att) biasadj(re74 re75 u74 u75)

// 以下两行表示用于偏误修正的协变量为所有用于匹配的协变量。

teffects nnmatch (re78 age-re75 u74 u75) (treat) if msample1, atet biasadj(age-re75 u74 u75)
nnmatch re78 treat age-re75 u74 u75 if msample1, metric(maha) robusth(2) tc(att) biasadj(bias)

// 以下两行表示1:2匹配。

teffects nnmatch (re78 age-re75 u74 u75) (treat) if msample1, atet biasadj(age-re75 u74 u75) nn(2)
nnmatch re78 treat age-re75 u74 u75 if msample1, metric(maha) robusth(2) tc(att) biasadj(bias) m(2)

// 以下两行表示先根据两个失业变量进行准确匹配。
// 运行下面这条命令会报错，因为稳健标准误估计要求每个个体必须存在两个以上匹配个体，只能把不符合这一条件的观测值删去。
teffects nnmatch (re78 age-re75 u74 u75) (treat) if msample1, ematch(u74 u75) atet biasadj(age-re75 u74 u75)

egen ematch=concat(u74 u75)
tab ematch treat

teffects nnmatch (re78 age-re75 u74 u75) (treat) if msample1 & ematch!="01", ematch(u74 u75) atet biasadj(age-re75 u74 u75)
nnmatch re78 treat age-re75 u74 u75 if msample1 & ematch!="01", exact(u74 u75) metric(maha) robusth(2) tc(att) biasadj(bias)


// 倾向得分匹配，估计ATT，以msample1为例
// 需重新搜索倾向得分估计式（过程从略）
// 官方命令teffects psmatch和用户自编命令psmatch2的平均处理效应估计完全一致，标准误有所差异。

teffects psmatch (re78) (treat re74 re75 u74 u75 married black age hispanic nodegree r75h u74u75 ne r75e u74e) if msample1, atet
psmatch2 treat re74 re75 u74 u75 married black age hispanic nodegree r75h u74u75 ne r75e u74e if msample1, outcome(re78) logit ties

mata: compare=("variable name","normalized diff before", "normalized diff after")
local xlist black hispanic age married nodegree edu re74 u74 re75 u75
foreach xvar of varlist `xlist' {
qui ttest `xvar', by(treat) unequal
local nd0=(r(mu_2)-r(mu_1))/sqrt((r(sd_1)^2+r(sd_2)^2)/2)
local nd0=round(`nd0',0.001)
ttest `xvar' if _weight!=., by(treat) unequal
local nd1=(r(mu_2)-r(mu_1))/sqrt((r(sd_1)^2+r(sd_2)^2)/2)
local nd1=round(`nd1',0.001)
mata: compare=(compare\"`xvar'","`nd0'","`nd1'")
}
mata: compare


/*
执行psmatch2之后会生成很多临时变量，提供了详尽的匹配细节。

	ties必须选上，否则若有多个ps完全相同的控制组个体（当协变量为离散变量时是有可能的），将会选择
		匹配在数据中当前排序靠前的个体，因此数据的排序会大幅影响结果。

	_id将样本按控制组在前处理组在后、ps由小到大顺序重新排列并标序。_n1给出了匹配个体的序号，
		当完全匹配到多个时（即ties，即使k=1），这个变量没有意义。
	
	_weight的取值，以ATT为例，每个处理组个体权重均为1；如果ps完全相同的多个(N)处理组个体匹配到
		多个(M)控制组个体，则这些控制组个体的权重均为N/M。由此我们可以手动计算ATT：

		tab treat if _weight!=.
		gen tmp=(2*treat-1)*_weight*re78
		sum tmp
		di r(sum)/104

	_weight未缺失的所有观测值即构成了匹配后的样本，在其基础上进行加权简单回归，也可以得到ATT：
	
		reg re78 treat [aw=_weight]
	
	_re78给出了匹配到的控制组个体的（平均）结果。由此我们可以手动计算ATT：
	
		gen tmp2=re78-_re78
		sum tmp2
	
	_pdif给出了匹配到的处理组与控制组之间ps的距离。
*/


// 下面再以teffects nnmatch为例，介绍如何得到经过协变量匹配的匹配样本，并用加权简单回归实现匹配估计的结果。
// 因为此时标准误估计不重要，因此采用非稳健的vce(iid)形式避免删除观测值。
// 下面的gen(mcu)选项生成了一系列以mcu为前缀的变量，
// 显示每个处理组个体所匹配到的控制组个体在样本中的序号。

teffects nnmatch (re78 age-re75 u74 u75) (treat), ematch(u74 u75) vce(iid) gen(mcu) atet

// 计算每个处理组个体匹配到的控制组个体的数目。

egen nn=rownonmiss(mcu*)

// 查看准确匹配变量取值不同状态下最终匹配到的控制组个体数目。

tab nn ematch

// 计算权重

gen wgt=.
forvalues i=105/243 {
quiet egen match=anymatch(mcu*), v(`i')
quiet gen wgt0=match/nn
egen wgt1=total(wgt0)
quiet replace wgt=wgt1 in `i'
drop match wgt0 wgt1
}

tab wgt

replace wgt=1 if wgt==.

// 对匹配样本进行加权简单回归，将得到和teffects nnmatch完全相同的ATT估计值。
reg re78 treat [aweight=wgt]




