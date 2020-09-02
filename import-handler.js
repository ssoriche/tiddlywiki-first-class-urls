/*\
module-type: startup

\*/

(function() {
    exports.name = "import-handler";
    exports.platforms = ["browser"];
    exports.after = ["load-modules"];
    exports.synchronous = true;

    const ALREADY_HAVE_URL = Symbol('ALREADY_HAVE_URL');
    const NO_METADATA_TITLE = Symbol('NO_METADATA_TITLE');

    let canonicalizeURL = require('$:/plugins/hoelzro/first-class-urls/canonicalize.js')
    let weHaveURLTiddler = require('$:/plugins/hoelzro/first-class-urls/url-check.js');
    let onLinksAdded = require('$:/plugins/hoelzro/first-class-urls/link-added.js');

    exports.startup = function() {
        $tw.wiki.addEventListener('change', function(changes) {
            // XXX transform all modified plugin-type: import tiddlers?
            if('$:/Import' in changes && changes['$:/Import'].modified) {
                let importTiddler = $tw.wiki.getTiddler('$:/Import');
                let status = importTiddler.getFieldString('status');
                let newImportFields = Object.create(null);
                if(status == 'pending' && importTiddler.getFieldString('already-imported') == '') {
                    let importData = $tw.wiki.getTiddlerData('$:/Import');

                    let links = [];
                    let promiseTitles = [];

                    for(let title in importData.tiddlers) {
                        let text = importData.tiddlers[title].text;
                        if(text.startsWith('http://') || text.startsWith('https://')) {
                            let canonicalURL = canonicalizeURL(text);
                            if(weHaveURLTiddler(canonicalURL)) {
                                newImportFields['selection-' + title] = 'unchecked';
                                newImportFields['message-' + title] = 'You already have this URL in your wiki';
                            } else {
                                links.push(text);
                                promiseTitles.push(title);
                            }
                        }
                    }

                    $tw.wiki.addTiddler(new $tw.Tiddler(importTiddler, {
                        'already-imported': 'true', // XXX shitty field name, but whatever (also, doesn't illustrate the state change properly)
                    }, newImportFields));

                    let addedTiddlers = {};

                    let fauxWikiForImport = {
                        addTiddler(tiddler) {
                            if(tiddler.fields.url_tiddler_pending_fetch) {
                                return $tw.wiki.addTiddler(tiddler);
                            } else {
                                addedTiddlers[tiddler.fields.title] = tiddler;
                            }
                        },

                        deleteTiddler(title) {
                            $tw.wiki.deleteTiddler(title);
                        },

                        generateNewTitle(title) {
                            return $tw.wiki.generateNewTitle(title);
                        },

                        getCreationFields() {
                            return $tw.wiki.getCreationFields();
                        },

                        getModificationFields() {
                            return $tw.wiki.getModificationFields();
                        }
                    };

                    // XXX error handling
                    onLinksAdded(fauxWikiForImport, links).then(function(results) {
                        let oldImportData = $tw.wiki.getTiddlerData('$:/Import'); // XXX this might have been deleted
                        let newImportData = Object.create(null);
                        newImportData.tiddlers = Object.create(null);

                        for(let oldTitle of promiseTitles) {
                            delete(oldImportData.tiddlers[oldTitle]);
                        }

                        Object.assign(newImportData.tiddlers, oldImportData.tiddlers);
                        for(let [title, tiddler] of Object.entries(addedTiddlers)) {
                            let fields = {};
                            for(let field of Object.keys(tiddler.fields)) {
                                fields[field] = tiddler.getFieldString(field);
                            }
                            // XXX do we run the risk of blowing shit away?
                            newImportData.tiddlers[title] = fields;
                        }
                        $tw.wiki.addTiddler(new $tw.Tiddler(
                            $tw.wiki.getTiddler('$:/Import'),
                            { text: JSON.stringify(newImportData) }));
                    }, function(error) {
                        $tw.utils.error(error);
                    });
                }
            }
        });
    };
})();
