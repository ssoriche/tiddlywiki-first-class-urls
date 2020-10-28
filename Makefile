export PLUGIN_TITLE=hoelzro/first-class-urls
export PLUGIN_NAME=First Class URLs
export PLUGIN_DESCRIPTION=Make it easier to import URLs into a TiddlyWiki
export PLUGIN_AUTHOR=RobHoelz
export PLUGIN_CORE_VERSION=5.1.21
export PLUGIN_SOURCE=https://github.com/hoelzro/tw-first-class-urls

index.html:
	bash build-index-html

first-class-urls.tid:
	bash build-plugin-tid

build:
	make -f tw-plugin-builder/Makefile build

clean:
	make -f tw-plugin-builder/Makefile clean
	rm -f index.html first-class-urls.tid
