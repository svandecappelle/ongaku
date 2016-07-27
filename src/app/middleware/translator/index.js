(function(Translator){
	"use strict";
	var nconf = require('nconf'),
        utils = require('./../../utils.js'),
        path = require('path'),
        fs = require('fs'),
        logger = require('log4js').getLogger("Translator"),
        _ = require('underscore');

  var availableLanguages;

	logger.setLevel('INFO');

  Translator.preload = function(){
      var rootDir = path.resolve(__dirname);
      var files = fs.readdirSync(rootDir);
      var dirs = []

      _.each(files, function(file){
          if (file[0] != '.'){
              var filePath = rootDir.concat('/').concat(file);
              var stat = fs.statSync(filePath);
              if (stat.isDirectory()){
                  dirs.push(file)
              }
          }
      });

      availableLanguages = dirs;

      _.each(availableLanguages, function(language){
          var lang = new Translator.Language(language);
          if (!Translator.languageCollectonInstance.has(lang)){
              Translator.languageCollectonInstance.load(lang);
          }
          logger.info("Loaded Language: ", language);
      });
  };

	Translator.getAvailableLanguages = function(){
		return availableLanguages;
	};

  Translator.LanguageCollecton = function(){
      this.langFiles = {};
  };

  Translator.LanguageCollecton.prototype.has = function(language){
      return this.langFiles[language.getLang()] !== undefined && this.langFiles[language.getLang()] !== null;
  };

  Translator.LanguageCollecton.prototype.load = function(language){
      this.langFiles[language.getLang()] = new Translator.LanguageLoader().load(language.getLang());
      return this.langFiles[language.getLang()];
  };

  Translator.LanguageCollecton.prototype.get = function(language){
      return this.langFiles[language.getLang()];
  };

  Translator.LanguageLoader = function(){};

  Translator.LanguageLoader.prototype.load = function(lang){
      var views = {};

      utils.walk(path.join(__dirname, './', lang), function (err, data) {

          for (var d in data) {
							logger.info(d);
              if (data.hasOwnProperty(d)) {
                  // Only load .json files
                  if (path.extname(data[d]) === '.json') {
                      logger.trace("Data:: ", require(data[d]));
											var view = path.relative(__dirname, data[d]).replace(lang.concat("/"), "").replace('.json', '');
                      logger.debug("loaded language file: " + path.relative(__dirname, data[d]) + " :: " + view);
                      views[view] = require(data[d]);
                  }
              }
          }
      });

      return views;
  }

  Translator.languageCollectonInstance = new Translator.LanguageCollecton();

  Translator.Language = function(lang){
      this._lang = lang;
      if (!Translator.languageCollectonInstance.has(this)){
          Translator.languageCollectonInstance.load(this);
      }
      this.datas = Translator.languageCollectonInstance.get(this);
  };

  Translator.Language.prototype.getLang = function(){
      return this._lang;
  };

  Translator.Language.prototype.get = function(view){
		if (view.startsWith("api/")){
			view = view.replace("api/", "");
		}
		logger.info("get lang ".concat(this.getLang()).concat(" for view: ").concat(view));
    var output = this.datas['global'];
    output = _.extend(output, this.datas[view]);
    return output;
  };
}(exports));
