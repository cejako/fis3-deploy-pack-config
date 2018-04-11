"use strict";

var config = {};
/**
 * deploy 插件接口
 * @param  {Object}   options  插件配置
 * @param  {Object}   modified 修改了的文件列表（对应watch功能）
 * @param  {Object}   total    所有文件列表
 * @param  {Function} next     调用下一个插件
 * @return {undefined}
 */
var entry = module.exports = function(options, modified, total, next) {
  var bid = options.bid,
  	  tmp = options.tmp;
  modified.forEach(function(file) {
	    if (file.isHtmlLike) {
	        var pageName = file.subpath.match(/\/pages\/([^\/]+)\/index.html/)[1],
	            content = file.getContent(),
	            badjsId = "",
	            AVReportBusiName = "",
	            scripts = [];
	        content.replace(/badjsId:\s*["|'](\S+)["|']/, function(text, id) {
	            if (id) {
	                badjsId = id;
	            }
	        });
	        content.replace(/busi_name:\s*["|'](\S+)["|']/, function(text, name) {
	            if (name) {
	                AVReportBusiName = name;
	            }
	        });
	        content.replace(/<script\s[^>]*\bsrc=(["'])([^>"']+)\1[^>]*>\s*<\/script>/g, function(text, a, url) {
	            if (url) {
	                if (url.indexOf('?_bid=') === -1) {
	                    url = url + '?_bid=' + bid;
	                }
	                scripts.push(url);
	            }
	        });
	        config[pageName] = Object.assign({}, config[pageName], {
	                badjsId: badjsId,
	                AVReportBusiName: AVReportBusiName,
	                scripts: scripts
	        });
	    }
	    if (file.isCssLike) {
	        var pageName = file.subpath.match(/\/pages\/([^\/]+)\/(\w.+).css/)[1],
	            styles = [],
	            url = file.domain + file.getHashRelease() + '?_bid=' + bid;
	        if (url) {
	            styles.push(url);
	        }
	        config[pageName] = Object.assign({}, config[pageName], {
	            styles: styles
	        });    
	    }
	    if (file.isJsLike) {
	        var match = file.subpath.match(/\/pages\/([^\/]+)\/(\w.+).js/),
	            url;
	        if (match) {
	            var pageName = match[1];
	            if (match[2] === 'init') {
	                url = file.domain + file.getHashRelease() + '?_bid=' + bid;
	                config[pageName].scripts && config[pageName].scripts.push(url);
	            } else if (match[2] === 'preload') {
	                url = file.domain + file.getHashRelease() + '?_bid=' + bid;
	                config[pageName] = Object.assign({}, config[pageName], {
	                    preprocess: [].concat(url)
	                });
	            }
	        }                
	    }
	});
	next();
	fis.util.write(fis.project.getProjectPath(tmp + '/now_config.json'), JSON.stringify(config));
};


entry.options = {
    tmp: '../.pack-tmp', // 临时文件夹

    bid: 152
};
