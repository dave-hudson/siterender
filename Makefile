.DEFAULT_GOAL := all

.PHONY: all

all: siterender.js

#
# Rule to pre-render all the pages of the site.
#
siterender.js: src/siterender.ts
	tsc \
		--strict \
		--target esnext \
		--module es6 \
		--esModuleInterop true \
		--moduleResolution node \
		--noImplicitOverride \
		--noImplicitReturns \
		--noPropertyAccessFromIndexSignature \
		--noFallthroughCasesInSwitch \
		--noUnusedLocals \
		--outDir . \
		src/siterender.ts

#
# Rules to clean up after builds.
#
.PHONY: clean 

clean:
	rm -f siterender.js

.PHONY: realclean

realclean: clean
	rm -fr coverage

#
# Run tests.
#
.PHONY: test

test:
	npm run test

