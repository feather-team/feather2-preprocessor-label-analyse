'use strict';

var REG = /<!--(?:(?!\[if [^\]]+\]>)[\s\S])*?-->|@(widget|pagelet)\(([^\)]+?)\)\s*(?:[\r\n]|$)/g;
var ROOT = feather.project.getProjectPath();
var SUFFIX = '.' + feather.config.get('template.suffix'), SUFFIX_REG = new RegExp('\\' + SUFFIX + '$');

module.exports = function(content, file){
    return content.replace(REG, function(all, type, attrs){
        if(type){
            attrs = attrs.split(/\s*,\s*/);

            var id = feather.util.stringQuote(attrs[0]).rest, pid = attrs[1];
            id = type + '/' + id.replace(SUFFIX_REG, '') + SUFFIX;

            var refFile = feather.file(ROOT, id);


            if(!file.extras[type]){
                file.extras[type] = [id];
            }else{
                file.extras[type].push(id);
            }

            if(!refFile.exists() || type == 'widget'){
                return '<link rel="import" href="' + id + '?__inline" />';
            }

            feather.compile(refFile);

            all = refFile.getContent().replace(/"##PLACEHOLDER_PAGELET_ASYNCS:\S+?##"/, '[]');

            if(pid){
                pid = feather.util.stringQuote(pid).rest;
                return '<textarea style="display: none" id="' + pid + '">' + all + '</textarea>';
            }

            return all;
        }

        return all;
    });
};