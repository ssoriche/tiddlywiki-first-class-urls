meta_files := $(patsubst %,%.meta,$(wildcard *.js *.tid))

build: plugin.info tiddlywiki.files $(meta_files)

clean:
	rm -f plugin.info tiddlywiki.files *.meta

plugin.info:
	echo '{}' | jq \
	    --arg plugin_title "$$PLUGIN_TITLE" \
	    --arg plugin_name "$$PLUGIN_NAME" \
	    --arg plugin_description "$$PLUGIN_DESCRIPTION" \
	    --arg plugin_author "$$PLUGIN_AUTHOR" \
	    --arg plugin_version "$$PLUGIN_VERSION" \
	    --arg plugin_core_version "$$PLUGIN_CORE_VERSION" \
	    --arg plugin_source "$$PLUGIN_SOURCE" \
	    '{title:("$$:/plugins/" + $$plugin_title),name:$$plugin_name,description:$$plugin_description,author:$$plugin_author,version:$$plugin_version,"core-version":$$plugin_core_version,source:$$plugin_source,"plugin-type":"plugin","list":"readme license history"}' > $@

tiddlywiki.files:
	echo '{}' | jq '{tiddlers: ($$ARGS.positional | map({file: .}))}' --args *.js *.tid > $@


%.js.meta: %.js
	echo "title: \$$:/plugins/$$PLUGIN_TITLE/$^" >> $@
	echo "type: application/javascript" >> $@
	echo "created: $$(TZ=utc git log --format=%ad --date=format:%Y%m%d%H%M%S000 -- $$tid | tail -n 1)000" >> $@
	echo "modified: $$(TZ=utc git log --format=%ad --date=format:%Y%m%d%H%M%S000 -- $$tid | head -n 1)000" >> $@

%.tid.meta: %.tid
	echo "title: \$$:/plugins/$$PLUGIN_TITLE/$(shell basename "$^" .tid)" >> $@
	echo "type: text/vnd.tiddlywiki" >> $@
	echo "created: $$(TZ=utc git log --format=%ad --date=format:%Y%m%d%H%M%S000 -- $$tid | tail -n 1)000" >> $@
	echo "modified: $$(TZ=utc git log --format=%ad --date=format:%Y%m%d%H%M%S000 -- $$tid | head -n 1)000" >> $@
