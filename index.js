'use strict';

var path = require('path'),
    fs = require('fs'),
    rimraf = require('rimraf'),
    archiver = require('archiver'),
    noop = new Function();

// polyfill
if (typeof Object.assign != 'function') {
  // Must be writable: true, enumerable: false, configurable: true
  Object.defineProperty(Object, "assign", {
    value: function assign(target, varArgs) { // .length of function is 2
      'use strict';
      if (target == null) { // TypeError if undefined or null
        throw new TypeError('Cannot convert undefined or null to object');
      }

      var to = Object(target);

      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];

        if (nextSource != null) { // Skip over if undefined or null
          for (var nextKey in nextSource) {
            // Avoid bugs when hasOwnProperty is shadowed
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    },
    writable: true,
    configurable: true
  });
}

var config = {};
var entry = module.exports = function(opts, modified, total, next) {
    clean(opts);

    total.filter(function(file) {
        return (opts.packDomain && file.domain && file.pack !== false) 
            || file.pack;
    }).map(function(file) {
        return {
        	file: file,
            subpath: opts.subpath(file),
            content: opts.content(file)
        };
    }).forEach(function(item) {
        fis.util.write(projectPath(opts.tmp, item.subpath), item.content);
        packJSON(item);
    });

    next();

    fis.util.write(projectPath(opts.tmp, '/now_config.json'), JSON.stringify(config));

    // TODO 使用增量打包，放到next()之前
    // 生成zip文件应该在所有文件写入tmp文件夹之后
    pack(opts.type, projectPath(opts.tmp), projectPath(opts.to));
};

function projectPath() {
    return fis.project.getProjectPath(fis.util.apply(fis.util, arguments));
}

var clean = function(opts) {
    rimraf.sync(projectPath(opts.tmp));
    rimraf.sync(projectPath(opts.to));
    clean = noop;
};

var pack = function(type, dir, output) {
    var archive = archiver(type)
        .bulk([{
            expand: true,
            cwd: dir,
            src: ['**', '!' + output.replace(dir, '').replace(/^\//, '')]
        }])
        .on('error', function() {
            fis.log.error('zip failed: ' + output);
        });

    fis.util.mkdir(path.dirname(output));
    archive.pipe(fs.createWriteStream(output));
    archive.finalize();

    // TODO 增量打包时remove
    pack = noop;
};

var packJSON = function(item) {
	var file = item.file,
		content = item.content,
		subpath = item.subpath;
    config.version = new Date().getTime();
	if (file.isHtmlLike) {
        var pageName = file.subpath.match(/\/pages\/([^\/]+)\/index.html/)[1],
            badjsId = "",
            AVReportBusiName = "",
            scripts = [];
        content.replace(/badjsId:\s*["']([^"']+)/, function(text, id) {
            if (id) {
                badjsId = id;
            }
        });
        content.replace(/busi_name:\s*["']([^"']+)/, function(text, name) {
            if (name) {
                AVReportBusiName = name;
            }
        });
        content.replace(/<script\s[^>]*\bsrc=(["'])([^>"']+)\1[^>]*>\s*<\/script>/g, function(text, a, url) {
            if (url) {
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
            styles = [];
            styles.push('/' + subpath);
        config[pageName] = Object.assign({}, config[pageName], {
            styles: styles
        });    
    }
    if (file.isJsLike) {
        var match = file.subpath.match(/\/pages\/([^\/]+)\/(\w.+).js/);
        if (match) {
            var pageName = match[1];
            if (match[2] === 'init') {
                config[pageName].scripts && config[pageName].scripts.push('/' + subpath);
            } else if (match[2] === 'preload') {
                config[pageName] = Object.assign({}, config[pageName], {
                    preprocess: [].concat('/' + subpath)
                });
            }
        }                
    }
};

entry.options = {
    tmp: '../.pack-tmp', // 临时文件夹

    type: 'zip', // 压缩类型, 传给archiver

    to: '../pack/pack.zip', // 输出压缩包名

    packDomain: true, // 是否打包所有包含domain属性的文件

    // 文件在压缩包中的路径
    subpath: function(file) {
        return typeof file.pack === 'string' ? file.pack : fis.util(
            (file.domain || '').replace(/^http:\/\//i, ''), 
            file.getHashRelease()
        );
    },

    // 文件内容
    content: function(file) {
        var inject = {
            version: Date.now()
        };
        return !file. _likes || !file. _likes.isHtmlLike 
            ? file.getContent()
            : (file.getContent() || '').replace(
                /(<script)/, 
                '<script>var pack = ' + JSON.stringify(inject) + '</script>$1'
            );
    }
};
