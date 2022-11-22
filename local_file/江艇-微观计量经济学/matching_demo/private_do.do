use private_data.dta, clear

list

tab group, gen(grp)

reg wage private

reg wage private if grp1+grp2==1

reg wage private grp*

reg wage private grp* if grp1+grp2==1


forvalues i=1/4 {
	gen g`i't=grp`i'*private
}

reg wage private grp1 grp2 grp3 g1t g2t g3t

gen ite=_b[private]+_b[g1t]*grp1
sum ite if grp1+grp2==1
sum ite if grp1+grp2==1 & private==1
sum ite if grp1+grp2==1 & private==0


reg wage private [aweight=watt]

reg wage private [aweight=watu]

reg wage private [aweight=wate]
