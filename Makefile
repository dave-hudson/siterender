.DEFAULT_GOAL := all

.PHONY: all

all: build/siterender.mjs

#
# Rule to pre-render all the pages of the site.
#
build/siterender.mjs: src/logic.ts src/siterender.ts
	npm run build

#
# Rules to clean up after builds.
#
.PHONY: clean 

clean:
	rm -f build/siterender.mjs
	rm -f build/*.map

.PHONY: realclean

realclean: clean
	rm -fr coverage
	rm -fr build

#
# Run tests.
#
.PHONY: test

test:
	npm run test

