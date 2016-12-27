'use strict';

//var REG = /<!--(?:(?!\[if [^\]]+\]>)[\s\S])*?-->|<%\s*(widget|extend|pagelet)\(\s*['"]([^'"]+)['"]\s*\)\s*%>|<%\s*block\(\s*['"]([^'"]+)['"](?:\s*,\s*((?:(?!\s*%>)[\s\S])+))?\s*\)\s*%>(?:((?:(?!<%)[\s\S])*)(?:<%\s*(\/block|endblock)\s*%>)|$)?/g;
var Path = require('path');
var EXTENDS_REG = /<extends\s+(\S+)\s*\/?>/;
var REF_REG = /<!--(?:(?!\[if [^\]]+\]>)[\s\S])*?-->|<(widget|pagelet)\s+(\S+)\s*\/?>/g;
var BLOCK_REG = /<block\s+(\S+)\s*>([\s\S]*?)<\/block>/g;

function getId(id){
    var SUFFIX = '.' + feather.config.get('template.suffix'), REG = new RegExp(SUFFIX.replace(/\./, '\\\\.') + '$', 'gi');
    return id.replace(SUFFIX, '') + SUFFIX;
}

function addRef(file, type, ref){
    if(!file.extras[type]){
        file.extras[type] = [ref];
    }else{
        file.extras[type].push(ref);
    }
}  

function addDeps(a, b){
    if(a && a.cache && b){
        if(b.cache){
            a.cache.mergeDeps(b.cache);
        }

        a.cache.addDeps(b.realpath || b);
    }
}

module.exports = function(content, file){    
    if(!file.isHtmlLike) return content;

    var blocks = {};
    var matches = content.match(EXTENDS_REG);

    content = content.replace(BLOCK_REG, function(all, bid, bContent){
        bid = feather.util.stringQuote(bid).rest;
        blocks[bid] = bContent;
        return '<!--BLOCK_START#' + bid + '-->' + bContent + '<!--BLOCK_END-->';
    });

    if(matches){
        var id = getId(feather.util.stringQuote(matches[1]).rest);

        if(id[0] == '.'){
            id = Path.join(Path.dirname(file.subpath), id);
        }

        var info = feather.project.lookup(id);

        if(info.file && info.file.isFile()){
            var extend = info.file;
            //使用临时文件存放，防止用户使用了pd模式，导致注释消失
            var bakFile = feather.file.wrap(feather.project.getProjectPath() + extend.subpathNoExt + '__bak__' + extend.ext);
            bakFile.setContent(extend.getContent());
            bakFile.optimizer = false;
            bakFile.release = false;
            
            extend.addLink(file.subpath);
            feather.compile(bakFile);
            feather.compile(extend);
            addDeps(file, extend);         
            addRef(file, 'extends', extend.id);

            content = bakFile.getContent();

            feather.util.map(blocks, function(name, block){
                var reg = new RegExp('<!--BLOCK_START#' + name + '-->[\\s\\S]*?<!--BLOCK_END-->', 'g');
                content = content.replace(reg, block);
            });
        }
    }

    return content.replace(REF_REG, function(all, refType, id){
        if(refType){
            var pid;

            id = feather.util.stringQuote(id).rest;

            if(id[0] == '.'){
                id = Path.join(Path.dirname(file.subpath), id);
            }else{
                id = refType + '/' + id;
            }

            if(refType == 'pagelet'){
                id = id.split('#');

                if(id[1]){
                    pid = id[1].replace('__bak__', '');
                }
                
                id = id[0];
            }

            var info = feather.project.lookup(getId(id));

            if(info.file && info.file.isFile()){
                var refFile = info.file;

                //使用临时文件存放，防止用户使用了pd模式，导致注释消失
                var bakFile = feather.file.wrap(feather.project.getProjectPath() + refFile.subpathNoExt + '__bak__' + refFile.ext);
                bakFile.setContent(refFile.getContent());
                bakFile.optimizer = false;
                bakFile.release = false;
                
                refFile.addLink(file.subpath);
                feather.compile(bakFile);
                feather.compile(refFile);
                addDeps(file, refFile);         
                addRef(file, refType, refFile.id);

                all = bakFile.getContent();

                if(refType == 'pagelet'){
                    all = all.replace(/\/\*PAGELET_ASYNCS_PLACEHOLDER:\S+?\*\//g, '');

                    if(pid){
                        return '<div style="display: none" id="' + pid + '">' + all + '</div>';
                    }
                }
            }
        }

        return all;
    });
};