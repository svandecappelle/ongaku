+function ($) {
    'use strict';

    var activateBottomPendingList = true;

    function TitleScroller() {
        this.appearCharLenghtLimit = 16;
        this.options = {};
    }

    TitleScroller.prototype.configure = function (opts) {
        var that = this;

        this.stop(function () {
            that.turn = 1;

            that.options = $.extend({
                prefix: "Ongaku: ",
                text: undefined,
                speed: 200,
                wait: 2000
            }, opts);

            document.title = that.options.prefix + that.options.text;
            that.currentTitle = that.options.text;
            if (that.appearCharLenghtLimit < that.options.text.length) {
                that.start();
            }
        });

    };

    TitleScroller.prototype.stop = function (callback) {
        var that = this;
        that.stopFlag = true;
        setTimeout(function () {
            that.stopFlag = false;
            callback();
        }, this.options.wait);
    };

    TitleScroller.prototype.start = function () {
        var that = this;
        if (that.options.text !== undefined) {
            that.currentTitle = that.currentTitle.substring(1, that.currentTitle.length) + that.currentTitle.substring(0, 1);
            document.title = that.options.prefix + that.currentTitle;
            setTimeout(function () {

                if (that.stopFlag) {
                    that.stopFlag = false;
                } else {
                    if (that.turn === that.currentTitle.length) {
                        that.turn = 1;
                        setTimeout(function () {
                            that.start();
                        }, that.options.wait);
                    } else {
                        that.turn += 1;
                        that.start();
                    }
                }
            }, that.options.speed);
        }
    };


    var Loader = function (targetElement) {
      this.targetElement = targetElement;
      this.loadContainer = $("<div>", {
        class: "loading-container"
      });
      var loadWidget = $("<div>", {
        class: "loader"
      });
      var loadSlidesContainer = $("<div>", {
        class: "loading-slide"
      });

      for (var i = 0; i < 3; i++) {
        var slide = $("<div>", {
          class: "slide"
        });
        loadSlidesContainer.append(slide);
      }

      loadWidget.append(loadSlidesContainer);
      this.loadContainer.append(loadWidget);
      this.isShowing = false;
    };

    Loader.prototype.show = function () {
      this.isShowing = true;
      $(this.targetElement).append(this.loadContainer);
    };

    Loader.prototype.hide = function () {
      this.isShowing = false;
      this.loadContainer.remove();
    };

    Loader.prototype.toggle = function () {
      if (this.isShowing){
        this.hide();
      } else {
        this.show();
      }
    };

    function Player() {
        this.titleScroller = new TitleScroller();
        this.titleScroller.start();
    }

    $.ongaku = new Player();

    Player.prototype.setUser = function (user) {
      this.user = user;
    };

    Player.prototype.getUser = function () {
      return this.user;
    };

    Player.prototype.isAnonymous = function () {
      return this.user === undefined || this.user === "";
    };

    Player.prototype.isFirst = function () {
        return this.current === undefined;
    };

    Player.prototype.setCurrent = function (currentId) {
        this.current = currentId;
    };

    Player.prototype.getCurrent = function () {
        return this.current;
    };

    Player.prototype.play = function (uid, encoding) {
      if ($.ongaku.themer.getBaseColor()){
        $(".playing").css({
          color: $.ongaku.themer.getBaseColor()
        });
      }
      $(".playing").removeClass('playing');
      this.current = uid;
      $.post('/api/statistics/plays/' + uid);

      $("#controls").attr("src", "/api/stream/".concat(uid));
      $("#mp3src").attr("src", "/api/stream/".concat(uid).concat(".".concat(encoding))).remove().appendTo("#controls");

      $("#controls")[0].pause();
      $("#controls")[0].load();
      $("#controls")[0].play();
      $.ongaku.audiowave.rebuild();
      if (['mp3', 'ogg', 'wav'].indexOf(encoding) === -1) {
        alertify.dismissAll();
        alertify.success('Transcoding...', 0);
      }

      $(".list-container").find("[data-uid='" + this.current + "']").addClass('playing').css({
        color: "#FFFFFF"
      });

      $(".current-playing-image").attr("src", "/song-image/"+this.current);
    };

    Player.prototype.stop = function (uid, encoding) {
        $("#controls")[0].stop();
    };

    Player.prototype.getPlayer = function () {
      return this.player;
    };

    function secondsToMinutes(time) {
      var minutes = Math.floor(time / 60);
      var seconds = Math.floor(time % 60);
      seconds = ("0" + (+seconds + 1)).slice(-2);
      return minutes + ":" + seconds;
    }

    Player.prototype.build = function (callback) {
      if ($('.player .media > audio').children().length > 0 && !this.isInitialised()) {

          $(".audio-player .next").on("click", function(){
            $.ongaku.next();
          });

          $(".audio-player .previous").on("click", function(){
            $.ongaku.previous();
          });

          this.initialised = true;
          this.player = new MediaElementPlayer("audio", {
              volume: 0.1,
              audioVolume: 'vertical',
              audioHeight: 50,
              features: ['progress', 'volume'],
              // force iPad's native controls
              iPadUseNativeControls: false,
              // force iPhone's native controls
              iPhoneUseNativeControls: false, 
              // force Android's native controls
              AndroidUseNativeControls: false,
              success: function (mediaElement) {
                  mediaElement.addEventListener('loadedmetadata', function () {
                      alertify.dismissAll();
                  });
                  mediaElement.addEventListener('ended', function () {
                      $.ongaku.next();

                      var parent = $(this).closest('.audio-player');
                      $(this).closest('.audio-player').find(".progress-bar").css("width", "100%");
                      parent.find('.playpause').removeClass('is-playing').addClass('is-paused');
                      parent.find('.playpause').find('.fa').removeClass('fa-pause').addClass('fa-play');
                      parent.removeClass('is-playing').addClass('is-paused').addClass('already-played');
                  });
                  mediaElement.addEventListener('play', function () {
                      //$.ongaku.getPlayer.volume = 1;
                      if ($.ongaku.isFirst()) {
                          alertify.warning('Add a track to play', 2);
                          $.ongaku.stop();
                      } else if ( $(".playing").length === 0) {
                          $(".play").find("[data-uid='" + $.ongaku.getCurrent() + "']").parent().parent().addClass('playing');
                      }

                      var otherPlayers =  $('audio').not(this);
                      var parent = $(this).closest('.audio-player');
                      var playButton = parent.find('.playpause');

                      $(this).removeClass('is-paused').addClass('is-playing');
                      playButton.find('.fa').removeClass('fa-play').addClass('fa-pause');
                      parent.removeClass('is-paused').addClass('is-playing');
                      if ($.ongaku.getCurrent()){
                        var title = $(".playlist").find("[data-uid='" + $.ongaku.getCurrent() + "']").find(".track-title").text() + " ";
                        $.ongaku.titleScroller.configure({
                            text: title,
                            speed: 500,
                            forceReset: true
                        });
                      }
                  });

                  mediaElement.addEventListener('error', function failed(e) {
                    alertify.dismissAll();
                    alertify.error("Error reading file: \n Check authentication rights.");
                  });

                  // add event listener
                  mediaElement.addEventListener('timeupdate', function(e) {
                      var parent = $(this).closest('.audio-player');
                      var currentTime = mediaElement.currentTime;
                      var duration = mediaElement.duration;
                      var percentage = (currentTime / duration) * 100 + "%";

                      if (currentTime > 0.5 && currentTime <= duration) {
                        $(this).closest('.audio-player').find(".progress-bar").css("width", percentage);
                        parent.find('.song-current-time').html(secondsToMinutes(currentTime) + ' / ');
                      }
                  }, false);

                  mediaElement.addEventListener('canplay', function(e){
                    $.ongaku.audiowave.rebuild();
                    if ($.ongaku.getCurrent()){
                      var title = $(".playlist").find("[data-uid='" + $.ongaku.getCurrent() + "']").find(".track-title").text() + " ";
                      $(".song-info .title").text(title);
                    }

                    if ($.ongaku.themer.getBaseColor()){
                      $(".mejs-time-loaded").css({
                        "background" : $.ongaku.themer.getBaseColor()
                      });
                    }

                    var parent = $(this).closest('.audio-player');
                    var playButton = parent.find('.playpause');
                    var duration = mediaElement.duration;

                    parent.find('.song-duration').html(secondsToMinutes(duration));
                    playButton.prop('disabled', false);

                    playButton.on('click', function(e){
                      if (parent.hasClass('is-paused')) {
                        mediaElement.play();
                      } else if (parent.hasClass('is-playing')) {
                        mediaElement.pause();
                      }
                    });

                    if ($.ongaku.getNextSong()){
                        $(".audio-player .next").prop('disabled', false);
                    }else{
                      $(".audio-player .next").prop('disabled', true);
                    }

                    if ($.ongaku.getPreviousSong()){
                        $(".audio-player .previous").prop('disabled', false);
                    }else{
                      $(".audio-player .previous").prop('disabled', true);
                    }
                  });

                  mediaElement.addEventListener('pause', function(e){
                      var parent = $(this).closest('.audio-player');
                      var playButton = parent.find('.playpause');
                      playButton.removeClass('is-playing').addClass('is-paused');
                      playButton.find('.fa').removeClass('fa-pause').addClass('fa-play');
                      parent.removeClass('is-playing').addClass('is-paused');
                  });

                  if (callback !== undefined) {
                      callback();
                  }
              },
              error: function (me) {
                console.log("failure build musique player:", me);
              }
          });
          $('.player .media > audio').show();
      } else {
          this.initialised = false;
          $('.player .media > audio').hide();
      }
    };

    Player.prototype.isInitialised = function () {
        return this.initialised;
    };

    Player.prototype.setInitialized = function (initialised) {
        this.initialised = initialised;
    };

    Player.prototype.getNextSong = function(){
      var nextSong = null;

      if (this.current) {
          nextSong = $(".playlist").find("[data-uid='" + this.current + "']").parent().next().find(".song").first();
      } else {
          nextSong = $(".playlist .song").first();
      }

      return nextSong;
    }

    Player.prototype.getPreviousSong = function(){
      var nextSong = null;
      if (this.current) {
          nextSong = $(".playlist").find("[data-uid='" + this.current + "']").parent().prev().find(".song").first();
      } else {
          nextSong = $(".playlist .song").first();
      }
      return nextSong;
    }

    Player.prototype.next = function () {
        var nextSong = this.getNextSong();
        if (nextSong) {
            var nextUid = nextSong.data('uid'),
                encoding = nextSong.data('encoding');
            $(".audio-player .next").prop('disabled', false);

            if ($.ongaku.getPreviousSong()){
                $(".audio-player .previous").prop('disabled', false);
            }

            if (nextUid) {
                this.play(nextUid, encoding);
            }
        } else {
          $(".audio-player .next").prop('disabled', true);
        }
    };

    Player.prototype.previous = function () {
        var previousSong = this.getPreviousSong();
        if (previousSong) {
            var nextUid = previousSong.data('uid'),
                encoding = previousSong.data('encoding');
            $(".audio-player .previous").prop('disabled', false);

            if ($.ongaku.getNextSong()){
                $(".audio-player .next").prop('disabled', false);
            }

            if (nextUid) {
                this.play(nextUid, encoding);
            }
        } else {
          $(".audio-player .previous").prop('disabled', true);
        }
    };

    var Themer = function(){
      var savedColor = Cookies.get("base-color");
      if (savedColor) {
        this.color = savedColor;
      }
    };

    Themer.prototype.getBaseColor = function () {
      return this.color;
    };

    Themer.prototype.setBaseColor = function (color) {
      this.color = color;
      if (color.match("rgb.*")){
        if (!color.match("rgba.*")) {
          color = color.replace("rgb", "rgba");
          color = color.replace(")", ", 1)");
        }
      }
      Cookies.set("base-color", color);

      $(".mejs-time-loaded").css({
        "background" : color
      });

      // fonts:
      $(".song:not(.playing)").css({
        color: color
      });
      $(".albumtitle").css({
        color: color
      });

      $("ul.group.album > li").css({
        "box-shadow": '0px -4px 0px 0px ' + color + 'inset'
      });
      $.ongaku.audiowave.setColor(color);
    };

    $.ongaku.themer = new Themer();

    function HandlerRegisteration(target, eventType, handle){
      this.target = target;
      this.eventType = eventType;
      this.handle = handle;
      return this;
    }

    HandlerRegisteration.prototype.unbind = function () {
      $(this.target).unbind(this.eventType);
    };

    HandlerRegisteration.prototype.bind = function () {
      $(this.target).on(this.eventType, this.handle);
    };

    function Controls() {

    }

    Controls.prototype.handlers = function () {
      this.handles = {
        "song": new HandlerRegisteration("a.song", "click", function () {
            $.ongaku.play($(this).data("uid"), $(this).data("encoding"));
        })
      };
      return this.handles;
    };

    Controls.prototype.bind = function () {
        console.log("Controls.bind");
        this.unbind();

        $.each(this.handlers(), function (eventName, handler){
          handler.bind();
        });

    };

    Controls.prototype.unbind = function () {
      if (this.handles){
        console.log("Controls.unbind");
        $.each(this.handles, function (index, value){
          console.log("Controls.unbind(".concat(index).concat(")"), value);
          value.unbind();
        });
      }
    };

    function MetadataLabel(title, value, editable){
      if (typeof value === 'object' && (!Array.isArray(value) || (Array.isArray(value) && value.length > 1))) {
        value = JSON.stringify(value)
      }

      var label = $("<tr>", {
        "class": "metadata"
      }),
        titleObj = $("<td>", {
          "class": editable ? "editable-mt-title" : "mt-title"
        }),
        valueObj = $('<td>');
      var valueLabel;
      if (editable){
        valueLabel = $('<input>', {
          "class": "editable-mt-value form-control",
          "style": "color: black;",
          "type": "text",
          'value': value
        });

        valueLabel.css({
          'padding': '5px 0px;'
        });

      } else {
        valueLabel = $('<div>', {
          "class": "mt-value"
        });
      }

      titleObj.html(title);
      try{
        if (title === 'duration' && (parseInt(value) > 60) ){
          value = Math.trunc(parseInt(value) / 60) + ":" + (parseInt(value) % 60);
        }
      } catch (ex){
        console.log("error: " + value);
      }
      valueObj.append(valueLabel);
      if (!editable){
        valueLabel.html(value);
      }
      label.append(titleObj);
      label.append(valueObj);
      return label;
    }

    function MetadatasArray(metadatas, editable){
      var container = $('<div>', {
        "class": editable ? "editable-mt-array" : "mt-array"
      });
      var array = $('<table>');
      if (editable){
        array.width('100%');
      }
      if (metadatas){
        $.each(metadatas, function(index, value){
          array.append(new MetadataLabel(index, value, editable));
        });
      }

      container.append(array);
      return $('<div>').append(container.clone());
    }

    function UserLib(){

    }

    UserLib.prototype.append = function (element) {
      $.ajax({
          url: '/api/user/library/add',
          type: 'POST',
          data: JSON.stringify(this.getElements(element)),
          contentType: 'application/json; charset=utf-8',
          dataType: 'json',
          async: false,
          success: function() {
            console.log("added");
          }
      });
    };

    UserLib.prototype.getElements = function (element) {
      var elementsToAppend;
      if ($(element).parent().data("uid") !== undefined && $(element).parent().data("uid") !== null){
        elementsToAppend = [];
        elementsToAppend.push($(element).parent());
      }else{
        elementsToAppend = $(element).parent().find(".track");
      }

      var jsonElementsAppend = [];
      $.each(elementsToAppend, function (index, value){
        jsonElementsAppend.push($(value).data("uid"));
      });
      return {elements: jsonElementsAppend};
    };

    UserLib.prototype.remove = function (element) {
      $.ajax({
          url: '/api/user/library/remove',
          type: 'POST',
          data: JSON.stringify(this.getElements(element)),
          contentType: 'application/json; charset=utf-8',
          dataType: 'json',
          async: false,
          success: function() {
            console.log("removed");
            $.ongaku.library.reset();
            $.ongaku.library.setPage(0);
            $.ongaku.library.fetch();
          }
      });
    };

    UserLib.prototype.appender = function (fromElement){
      var albumLibAppender = $('<a>', {
        class: 'trackaction tracklibappend',
        "data-placement": "bottom",
        "data-toggle": "tooltip",
        "data-original-title": "Add all tracks to my library"
      });
      var glyficonAlbumLibAppender = $('<i>', {
        class: 'glyphicon glyphicon-book'
      });

      albumLibAppender.append(glyficonAlbumLibAppender);
      fromElement.append(albumLibAppender);

      albumLibAppender.on("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          new UserLib().append($(this));
      });
      $(albumLibAppender).tooltip();

      return albumLibAppender;
    };

    UserLib.prototype.remover = function (fromElement){
      var albumLibRemover = $('<a>', {
        class: 'trackaction tracklibremove',
        "data-placement": "bottom",
        "data-toggle": "tooltip",
        "data-original-title": "Remove all tracks from my library"
      });
      var glyficonAlbumLibRemover = $('<i>', {
        class: 'glyphicon glyphicon-minus'
      });

      albumLibRemover.append(glyficonAlbumLibRemover);
      fromElement.append(albumLibRemover);

      albumLibRemover.on("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          new UserLib().remove($(this));
      });
      $(albumLibRemover).tooltip();

      return albumLibRemover;
    };

    $.ongaku.controls = new Controls();

    function LibraryArtist(artist, view){
      this.artist = artist;
      this.artistElement = $('<li>');
      var artistDetailElement = $("<a>", {
        class: 'link artist-link image-extensible',
        href: artist.image
      }).on("click", function(ev){
        ev.stopPropagation();
        ev.preventDefault();
        $(this).toggleClass("extended");
      });

      var artistImage = $('<img>', {class: 'artist', src: artist.image});
      var artistName = $('<span>', {class: 'artistname'});
      artistName.html(artist.artist);
      artistDetailElement.append(artistImage);
      artistDetailElement.append(artistName);

      this.artistElement.append(artistDetailElement);

      var artistAppender = $('<a>', {
        class: 'trackaction',
        "data-placement": "bottom",
        "data-toggle": "tooltip",
        "data-original-title": "Add all tracks to current playlist"
      });
      var glyficonArtistAppender = $('<i>', {
        class: 'glyphicon glyphicon-plus',
      });

      artistAppender.append(glyficonArtistAppender);
      if (artist.download !== false) {
        var artistDownloader = $('<a>', {
          class: 'trackaction artist-download',
          "data-placement": "bottom",
          "data-toggle": "tooltip",
          "data-original-title": "Download tracks",
          "href": "/api/album-download/".concat(artist.artist).concat("/").concat("all"),
          "target": "_self"
        });
        var glyficonArtistDownloader = $('<i>', {
          class: 'glyphicon glyphicon-download',
        });
        artistDownloader.append(glyficonArtistDownloader);
      }
      this.artistElement.append(artistAppender);
      if (!$.ongaku.isAnonymous()){
        if (artist.download !== false) {
          this.artistElement.append(artistDownloader);
        }

        if (view){
          new UserLib().remover(this.artistElement);
        } else {
          new UserLib().appender(this.artistElement);
        }
      }

      $(artistAppender).tooltip();

      artistAppender.on("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          $.ongaku.playlist.appendFromElement($(this));
      });

      this.artistAlbums = $('<ul>', {class: "group album"});
      this.artistElement.append(this.artistAlbums);
    }

    LibraryArtist.prototype.get = function (album, view) {
      return this.artistElement;
    };

    LibraryArtist.prototype.append = function (object) {
      this.artistAlbums.append(object);
    };

    LibraryArtist.prototype.album = function (album, view) {
      var artistName = this.artist.artist;
      this.append(new LibraryAlbum({
          title: album.title,
          tracks : album.tracks,
          cover: album.cover,
          artist: artistName,
          download: album.download,
          hideTitle: album.hideTitle
        }, view));
    };

    function LibraryAlbum(album, view){
      var baseThemeColor = $.ongaku.themer.getBaseColor(),
        albumElement = $('<li>');

      var albumDetailElement = $("<a>", {class: 'link image-extensible'}).on("click", function(ev){
        ev.stopPropagation();
        ev.preventDefault();
        $(this).toggleClass("extended");
      });
      var albumImage = $('<img>', {class: 'album', src: album.cover});
      var albumTitle = $('<span>', {class: 'albumtitle'});
      var albumAppender = $('<a>', {
        class: 'trackaction',
        "data-placement": "left",
        "data-toggle": "tooltip",
        "data-original-title": "Add all tracks to current playlist"
      });
      var glyficonAlbumAppender = $('<i>', {
        class: 'glyphicon glyphicon-plus'
      });

      if (album.download !== false){
        var albumDownloader = $('<a>', {
          class: 'trackaction artist-download',
          "data-placement": "left",
          "data-toggle": "tooltip",
          "data-original-title": "Add all tracks to current playlist",
          "href": "/api/album-download/".concat(album.artist).concat("/").concat(album.title),
          "target": "_self"
        });
        var glyficonAlbumDownloader = $('<i>', {
          class: 'glyphicon glyphicon-download',
        });
        albumDownloader.append(glyficonAlbumDownloader);
      }
      albumAppender.append(glyficonAlbumAppender);
      albumElement.append(albumAppender);

      if (!$.ongaku.isAnonymous()){
        if (album.download !== false){
          albumElement.append(albumDownloader);
        }
        if (view){
          new UserLib().remover(albumElement);
        } else {
          new UserLib().appender(albumElement);
        }
      }
      $(albumAppender).tooltip();

      albumAppender.on("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          $.ongaku.playlist.appendFromElement($(this));
      });
      if (!album.hideTitle) {
        albumTitle.html(album.title);
      }
      albumDetailElement.append(albumImage);
      albumDetailElement.append(albumTitle);
      albumElement.append(albumDetailElement);

      albumElement.append(new LibraryTracksList(album.tracks, view));

      if (baseThemeColor){
        albumElement.css({
          "box-shadow": '0px -4px 0px 0px ' + baseThemeColor + 'inset'
        });
        albumTitle.css({
          color: baseThemeColor
        });
      }

      return albumElement;
    }

    function LibraryTracksList(tracks, view) {
      var tracksElement = $('<ul>', {class: "group tracklist"});
      $.each(tracks, function(index, track){
        var trackElement = $('<li>', {
          "class": "song-track"
        });
        var trackDetailElement = $('<div>', {
          class: 'track trackappend',
          "data-uid": track.uid,
          "data-encoding": track.encoding,
          "data-placement": "bottom auto",
          "data-toggle": "tooltip",
          "data-title": "Add track to current playlist"
        });

        trackDetailElement.html(track.title);

        if (!$.ongaku.isAnonymous()){
          if (view){
            new UserLib().remover(trackDetailElement);
          } else {
            new UserLib().appender(trackDetailElement);
          }
        }

        var trackShowDetail = $('<a>', {
          "tabindex": 0,
          "title": "Track metadatas",
          "class": "trackaction metadatas-details",
          "data-placement": "left",
          "data-toggle": "popover",
          "data-html": "true",
          "data-content": new MetadatasArray(track.metadatas).html(),
          "data-trigger": "hover",
          "data-delay": 100
        });
        var glyphShowDetail = $('<i>', {
          "class": 'glyphicon glyphicon-info-sign' // metadata-track,
        });
        trackShowDetail.append(glyphShowDetail);
        trackElement.append(trackShowDetail);

        if (!$.ongaku.isAnonymous()){
          var trackDownloader = $('<a>', {
            class: 'trackaction track-download',
            "data-placement": "bottom",
            "data-toggle": "tooltip",
            "data-original-title": "Download tracks",
            "href": "/api/track-download/".concat(track.uuid),
            "target": "_self"
          });
          var glyficonTrackDownloader = $('<i>', {
            class: 'glyphicon glyphicon-download',
          });
          trackDownloader.append(glyficonTrackDownloader);
          trackElement.append(trackDownloader);
        }

        trackElement.append(trackDetailElement);
        tracksElement.append(trackElement);
        $(trackDetailElement).tooltip();

        $(trackShowDetail).on("click", function(){
          showMetadatas(track);
        });


        trackDetailElement.on("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            $.ongaku.playlist.appendFromElement($(this));
        });
      });
      return tracksElement;
    }

    function showMetadatas(track){
      var popup = new Popup(track.artist + ' / ' + track.album + ' / ' + track.title);
      popup.append(new MetadatasArray(track.metadatas, true).html());
      popup.actions([
        {
          text: 'Close',
          callback: function(){
            popup.hide();
          }
        }
      ]);
      popup.show();
    }

    function Popup(title) {
        this.dom = $('<div>', {
            class: 'modal'
        });

        this.dialog = $('<div>', {
            class: 'modal-dialog'
        });

        this.header = $('<div>', {
            class: 'modal-header'
        });

        this.titleElement = $('<h4>', {
            class: 'modal-title'
        });
        this.titleElement.text(title);

        this.content = $('<div>', {
            class: 'modal-content'
        });
        this.actionsElement = $('<div>', {
         class: 'modal-footer'
        });

        this.header.append(this.titleElement);
        this.content.append(this.header);

        this.body = $('<div>', {
            class: 'modal-body'
        });

        this.loader = $('<div>', {
            class: 'loader'
        });
        this.loader.append($('<i>', {
            class: 'fa fa-circle-o-notch fa-spin fa-3x fa-fw'
        }));

        this.content.append(this.body);
        this.dialog.append(this.content);
        this.dom.append(this.dialog);


        var that = this;

        return this;
    };

    Popup.prototype.append = function (element) {
        $(this.body).append(element);
        return this;
    };

    Popup.prototype.get = function () {
        return this.dom;
    };

    Popup.prototype.top = function (top) {
        this.dialog.css({
            'margin-top': top
        });
    };

    Popup.prototype.getContent = function () {
        return this.body;
    };

    Popup.prototype.show = function () {
        $(this.dom).modal('show');
        var that = this;
        $(this.dom).on('hidden.bs.modal', function () {
            $(that.dom).remove();
        });
    };

    Popup.prototype.hide = function () {
        $(this.dom).modal('hide');
    };

    Popup.prototype.loading = function (isLoading) {
        if (isLoading !== undefined && isLoading || isLoading === undefined) {
            $(this.body).append(this.loader);
        } else {
            this.loader.remove();
        }
    };

    Popup.prototype.title = function (title) {
        this.titleElement.text(title);
    };

    Popup.prototype.indice = function (indice) {
        this.indiceElement.text(indice.value);
        if (indice.css) {
            this.indiceElement.css(indice.css);
        }
    };

    Popup.prototype.actions = function (actions) {
        var that = this;
        $.each(actions, function (index, value) {
          var button = $('<button>', {
            class: 'btn btn-primary'
          });

          button.text(value.text);
          button.on('click', value.callback);
          button.css({
              'float': 'right'
          });
          that.actionsElement.append(button);
        });
        this.content.append(this.actionsElement);
    };

    function Library() {
      this.useJscrollPane = false;
      this.videos = [];
      this.page = 0;
      this.type = "audio";
      this.loader = new Loader(".library .lib");
    }

    Library.prototype.setPage = function (page) {
      this.page = page;
    };

    Library.prototype.reset = function (page) {
      $(".lib.group.artist.open").empty();
      this.noOtherDataToLoad = false;
      if (this.videos){
        for (var i = 0; i < this.videos.length; i++) {
          if (this.videos[i]){
            this.videos[i].dispose();
          }
        }

        this.videos = [];
      }
      this.searchPattern = null;
      this.searching = false;
      this.view = undefined;
    };

    Library.prototype.handlers = function () {
      this.handles = {
        "searchbox" : new HandlerRegisteration("input.searchbox", "change", function () {
            $.ongaku.library.search($(this).val());
        }),
        "album" : new HandlerRegisteration(".appendplaylist:not(.disabled)", "click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            $.ongaku.playlist.appendFromElement($(this));
        }),
        "eraser": new HandlerRegisteration(".fa-eraser", "click", function(){
            $.ongaku.playlist.clear();
        }),
        "track" : new HandlerRegisteration(".trackappend:not(.disabled)", "click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            $.ongaku.playlist.appendFromElement($(this));
        }),
        "libappend": new HandlerRegisteration(".tracklibappend:not(.disabled)", "click", function (event){
          event.preventDefault();
          event.stopPropagation();
          new UserLib().append($(this));
        }),
        "libremove": new HandlerRegisteration(".tracklibremove:not(.disabled)", "click", function (event){
          event.preventDefault();
          event.stopPropagation();
          new UserLib().remove($(this));
        })

      };

      return this.handles;
    };

    Library.prototype.bind = function (view) {
      var that = this;
      this.view = view;
      this.unbind();

      $.each(this.handlers(), function (type, handler){
        handler.bind();
      });

      $(".dropdown-menu.groupby a").on("click", function(){
        that.setGroupBy($(this).data("groupby"));
        $.get("/api/audio/groupby/" + $(this).data("groupby"), {
          success: function(){
            setTimeout(function(){
              $.ongaku.library.reset();
          		$.ongaku.library.clear();
          		$.ongaku.library.setPage(0);
          		$.ongaku.library.bind();
          		$.ongaku.library.fetch();
            }, 500);
          }
        });
      });

      this.type = $("input.searchbox").data("type");
      this.scrollingLoader();
    };

    Library.prototype.scrollingLoader = function () {
      if (this.libraryScrollPane){
        this.libraryScrollPane.unbind('jsp-scroll-y');
      }
      if (this.useJscrollPane){
        this.libraryScrollPane = $('.main-content').jScrollPane();

        this.libraryScrollPane.bind('jsp-scroll-y', function(event, scrollPositionY, isAtTop, isAtBottom) {
          // For asynchronous loading debug
          // console.log('Handle jsp-scroll-y', 'isAtBottom=', isAtBottom);
          if (isAtBottom){
            $.ongaku.library.fetch();
          }
        });
      } else {
        $(window).scroll(function() {
            // console.log('Handle scroll window', $(window).scrollTop() + ' + ' + $(window).height(), $(document).height());
            if($(window).scrollTop() + $(window).height() == $(document).height()) {
              $.ongaku.library.fetch();
            }
        });
      }
    };

    Library.prototype.unbind = function () {
      if (this.handles){
        $.each(this.handles, function (index, value){
          value.unbind();
        });
      }
    };

    Library.prototype.search = function (pattern) {
        if (pattern) {
          this.searchPattern = pattern;
          this.searching = true;
          this.page = 0;
          $(".downloader").attr("href", "/api/download/" + pattern + "/all");
          $(".downloader").show();

        } else {
          $(".downloader").attr("href", "#");
          $(".downloader").hide();

          this.page = -1;
          this.searching = false;
        }

        this.noOtherDataToLoad = false;
        $.ongaku.library.clear();
        $.ongaku.library.fetch();

    };

    Library.prototype.buildSearch = function (library) {
      this.clear();
      $(".lib.group.artist.open").addClass("search-results");
      this.append(library);
    };

    Library.prototype.clear = function(){
      $(".lib.group.artist.open").empty();
    };

    Library.prototype.setGroupBy = function (groupBy) {
      this.groupBy = groupBy;
    };

    Library.prototype.getGroupBy = function () {
      return this.groupBy;
    };

    Library.prototype.append = function (library) {
      var that = this;
      // TODO load using the group by value.
      if (this.type === 'audio'){
        $.each(library, function (index, groupOne) {
          // For asynchronous loading debug
          // console.log("audio: " + index);
          //console.log(groupOne);


          // specific multi groups:
          var groups = that.getGroupBy().split(",");
          if (groups[0] !== "artist" && groups.length > 1){
            var appendTo = $(".lib.group.artist.open");
            for (var i = 0; i < groups.length; i++) {
              if (groupOne[groups[i]] !== undefined){
                if (groupOne.tracks){
                  var albumLibrary = new LibraryAlbum({
                    title: groupOne[groups[i]] ? groupOne[groups[i]].toString() : "-",
                    tracks : groupOne.tracks,
                    artist: "all",
                    download: false
                  }, that.view);

                  appendTo.append(albumLibrary);
                } else {
                  var artistLibrary = new LibraryArtist({
                    artist: groupOne[groups[i]]
                  }, that.view);
                  appendTo = artistLibrary;

                  if (groups.length > i + 1) {
                    groupOne = groupOne[groups[i + 1]];

                    $.each(groupOne, function(index, val){
                      if (val.tracks){
                        var albumLibrary = new LibraryAlbum({
                          title: val.title,
                          tracks : val.tracks,
                          artist: "all",
                          download: false,
                          cover: val.image
                        }, that.view);
                        appendTo.append(albumLibrary);
                      }
                    });
                  }
                  $(".lib.group.artist.open").append(artistLibrary.get());
                }
              }
            }
          }else{
            if (groupOne.artist || groupOne.albums || groupOne.tracks){
              var groupTitle = groupOne.artist ? groupOne.artist : (groupOne[that.getGroupBy()] ? groupOne[that.getGroupBy()].toString() : "-");
              var artistLibrary = new LibraryArtist({
                artist: groupTitle,
                image: groupOne.image,
                download: groupOne.artist !== undefined
              }, that.view);
              if (groupOne.albums){
                $.each(groupOne.albums, function(title, album){
                  artistLibrary.album(album, that.view);
                });
              } else {
                if (groupOne.tracks){
                  var albumLibrary = {
                    title: groupOne.artist ? "all" : "",
                    hideTitle: true,
                    tracks : groupOne.tracks,
                    artist: "all",
                    download: groupOne.artist !== undefined
                  };
                  artistLibrary.album(albumLibrary, that.view);
                }
              }
              $(".lib.group.artist.open").append(artistLibrary.get());
            } else if (groupOne.album) {
              if (groupOne.tracks){
                var albumLibrary = new LibraryAlbum({
                  title: groupOne.album ? groupOne.album : "all",
                  tracks : groupOne.tracks,
                  cover: groupOne.cover,
                  artist: "all"
                }, that.view);
                $(".lib.group.artist.open").append(albumLibrary);
              }
            }
          }
        });
        $('.metadatas-details').popover({
          viewport: { "selector": ".sidebar", "padding": 10 }
        });

        //$(".artist-img").magnificPopup({type:'image'});

      } else if (this.type === 'video'){
        //this.clear();
        if (this.searching){
          this.videoDispose();
        }

        $.each(library, function (index, video) {
          var videoElement = $('<li>', {
            style: "width: 465px; display: inline-block;"
          });
          var videoLink = $('<a>', {
            class: "link video"
          });
          var videoName = $('<div>', {
            class: 'name'
          });
          videoName.html(video.name);

          var videoHtml5 = $('<video>', {
            class : 'player-video video-js vjs-default-skin not-initialized',
            height: "253",
            width: "450",
            id : video.uid,
            preload: "metadatas",
            controls: true
          });
          var videoSource = $('<source>', {
            src : "/api/video/stream/".concat(video.uid),
            type : "video/".concat(video.extension)
          });

          videoHtml5.append(videoSource);
          videoLink.append(videoName);
          videoLink.append(videoHtml5);
          videoElement.append(videoLink);

          $(".lib.group.artist.open").append(videoElement);
        });
        this.loadVideo();
      }
      this.scrollingLoader();
    };

    Library.prototype.fetch = function () {
      var that = this,
        genericUrl;
      if (!this.isFetchPending && !this.noOtherDataToLoad){

        this.isFetchPending = true;
        // For asynchronous loading debug
        // console.log("Getting new page: " + this.page);
        if (this.view){
          genericUrl = "/api/".concat(this.view);
        }else{
          genericUrl = "/api/".concat(this.type);
        }

        genericUrl = genericUrl.concat("/library/");

        if (this.searching){
          genericUrl = genericUrl.concat("filter/").concat(this.searchPattern).concat("/");
        }
        genericUrl = genericUrl.concat(this.page);

        this.page += 1;
        this.loader.toggle();
        console.log("fetching page: " + genericUrl);
        $.get(genericUrl, function(output){
          // For asynchronous loading debug
          // console.log("append lib: "+ output);

          if (output === undefined || output === null || output.length === 0) {
            that.noOtherDataToLoad = true;
          } else {
            $.ongaku.library.append(output);
          }
          that.loader.toggle();
          that.isFetchPending = false;
        });
      }
    };

    Library.prototype.loadVideo = function () {
      if (this.videos === null){
        this.videos = [];
      }

      var that = this;
      $("video.not-initialized").each(function(){
				// For asynchronous loading debug
        // console.log($( this ).attr('id'));
				$(this).removeClass(".not-initialized");
        that.videos.push(videojs($( this ).attr('id'), {width: "450", height: "253"}, function(){
					// Player (this) is initialized and ready.
				}));
			});
    };

    Library.prototype.videoDispose = function () {
      if (this.videos !== null){
        $.each(this.videos, function(index, player){
  				if (player) {
            try {
              player.dispose();  
            } catch (err) {
              // nothing to do it is a video player issue
            }
          }
  			});
      }
      this.videos = [];
    };

    $.ongaku.library = new Library();

    function Playlist() {

    }

    Playlist.prototype.remove = function (uidFile) {
      $("#save-current-playlist").prop('disabled', false);
      $.post("/api/playlist/remove/".concat(uidFile), function (playlist) {
          $.ongaku.playlist.rebuild(playlist);
      });
    };

    Playlist.prototype.clear = function () {
      $("#save-current-playlist").prop('disabled', false);
      $.post("/api/playlist/clear", function (playlist) {
          $.ongaku.playlist.rebuild(playlist);
      });
    };

    Playlist.prototype.append = function (uidFile) {
      $("#save-current-playlist").prop('disabled', false);
      $.post("/api/playlist/add/".concat(uidFile), function (playlist) {
          $.ongaku.playlist.rebuild(playlist);
          if ($(".playlist li").length === 1) {
              $.ongaku.next();
          }
      });
    };

    Playlist.prototype.appendFromElement = function (element) {
      $("#save-current-playlist").prop('disabled', false);
      // TODO check if test on lenght is necessary or not.
      // For asynchronous lib append debug
      // console.log("append from element");
      var elementsToAppend = $(element).parent().find(".track");
      if (elementsToAppend.length > 1){
        var jsonElementsAppend = [];
        $.each(elementsToAppend, function (index, value){
          jsonElementsAppend.push($(value).data("uid"));
        });
        $.ajax({
            url: '/api/playlist/addgroup',
            type: 'POST',
            data: JSON.stringify({elements: jsonElementsAppend}),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            async: false,
            success: function(playlist) {
                $.ongaku.playlist.rebuild(playlist);

                if ($(".playlist .song").length === 1) {
                    $.ongaku.next();
                }
            }
        });
      } else {
        $(element).parent().find(".track").each(function (id, track) {
            $.ongaku.playlist.append($(track).data("uid"));
        });
      }
    };

    Playlist.prototype.rebuild = function (playlist) {
      $("ul.playlist").empty();

      if (playlist && playlist.all) {
        if (playlist.all.length === 0){
          $(".player .media").empty();
          $.ongaku.setInitialized(false);
        }

        if (playlist.name){
          $("#playlistname").val(playlist.name);
        }

        var tracknumber = 0;

        $.each(playlist.all, function (index, val) {
            tracknumber += 1;
            $("ul.playlist").append(new Track(tracknumber, val));
        });

        var trackObj = playlist.lastAdded;

        if (!trackObj && playlist.all && playlist.all.length > 0){
          trackObj = playlist.all[0];
        }

        if (trackObj){
          var audioControls = $("<audio>", {
            id: 'controls',
            controls: 'controls',
            width: '100%'
          });
          var source = $("<source>",{
            id: 'mp3src',
            type: 'audio/'.concat(trackObj.encoding),
            src: '/api/stream/'.concat(trackObj.uid).concat(".").concat(trackObj.encoding)
          });
        }

        $.ongaku.controls.bind();
        $('.scroll-pane').jScrollPane();

        if (!$.ongaku.isInitialised()) {
            console.log("Build controls for first init plays");
            $(".player .media").empty();
            $(".player .media").show();
            $(".player .media").html(audioControls);
            $(".player .media > audio").html(source);
            $.ongaku.build(function () {
                $.ongaku.next();
            });
        } else {
          $(".list-container").find("[data-uid='".concat($.ongaku.getCurrent()).concat("']")).addClass('playing');
        }
      } else {
        $(".player .media").empty();
        $.ongaku.setInitialized(false);
      }
    };

    Playlist.prototype.fetch = function(){
      $.get("/api/playlist", function (playlist) {
          $.ongaku.playlist.rebuild(playlist);
      });
    };

    Playlist.prototype.loadAllPlaylists = function () {
      $(".playlists-dropdown").empty();
      $.get("/api/user/playlists", function(output){
        $.each(output, function(index, playlist){
          var playlistBlock = $("<li>");
          var playlistAnchor = $("<a>", {
            class: "playlist-element"
          });
          playlistAnchor.text(playlist);
          playlistBlock.append(playlistAnchor);
          $(".playlists-dropdown").append(playlistBlock);

          $(playlistAnchor).click(function (){
            var playlistName = $(this).text();
            $.get("/api/user/playlists/" + playlistName, function(playlist){

              $.post("/api/user/playlists/load/" + playlistName, function(){
                $("#playlistname").val(playlistName);
                $.ongaku.playlist.rebuild(playlist);
              });
            });
          });
        });
      });
    };

    Playlist.prototype.handlers = function () {
      this.handles = {
        "save-current-playlist" : new HandlerRegisteration("#save-current-playlist", "click", function () {
          var playlistname = $("#playlistname").val();
          if (playlistname && playlistname !== ""){
            $.ajax({
                url: '/api/playlist/save',
                type: 'POST',
                data: JSON.stringify({playlistname: playlistname}),
                contentType: 'application/json; charset=utf-8',
                dataType: 'json',
                async: false,
                success: function() {
                  console.log("saved");
                  $("#save-current-playlist").prop('disabled', true);
                  $.ongaku.playlist.loadAllPlaylists();
                }
            });
          } else {
            alertify.error('Playlist name could not be empty');
          }
        }),
        "new-playlist" : new HandlerRegisteration("#new-playlist", "click", function () {
          $("#playlistname").val("");
          $.post("/api/user/playlists/new", function(err){
            $.ongaku.playlist.rebuild();
          });
        }),
        "delete-playlist" : new HandlerRegisteration("#delete-playlist", "click", function () {
          var playlistname = $("#playlistname").val();
          if (playlistname && playlistname !== ""){
            $.post("/api/user/playlists/delete/" + playlistname, function(err){
              $("#playlistname").val("");
              $("#save-current-playlist").prop('disabled', true);
              $.ongaku.playlist.rebuild();
              $.ongaku.playlist.loadAllPlaylists();
            });
          } else {
            alertify.error('Select a playlist to delete before.');
          }
        })
      };
      return this.handles;
    };

    Playlist.prototype.bind = function () {
      $.each(this.handlers(), function (type, handler){
        handler.bind();
      });
    };

    var PendingTrack = function (val){
      var track = $("<div>", {
        class: 'song'
      });
      var animationLayer = $("<div>", {
        class: 'layer'
      });
      var topAnimateBorder = $("<div>", {class: 'top'});
      var bottomAnimateBorder = $("<div>", {class: 'bottom'});
      var leftAnimateBorder = $("<div>", {class: 'left'});
      var rightAnimateBorder = $("<div>", {class: 'right'});
      animationLayer.append(topAnimateBorder);
      animationLayer.append(leftAnimateBorder);
      animationLayer.append(rightAnimateBorder);
      animationLayer.append(bottomAnimateBorder);

      var trackInfos = $("<div>", {
        class: 'info'
      });
      var trackTitle = $("<div>", {class: "song-title"});
      trackTitle.html(val.title);
      trackInfos.append(trackTitle);
      var trackArtist = $("<div>", {class: "song-artist"});
      trackArtist.html(val.artist);
      trackInfos.append(trackArtist);
      var trackDuration = $("<div>", {class: "song-infos"});
      trackDuration.html(val.duration);
      trackInfos.append(trackDuration);

      var trackPlay = $("<div>", {
        class: "play"
      });
      var playButton = $("<div>", {
        class: 'button',
        "data-uid": val.uid
      });
      playButton.html("Play");
      trackPlay.append(playButton);

      track.append(animationLayer);
      track.append(trackInfos);
      track.append(trackPlay);
      return track;
    };

    var Track = function (tracknumber, val){
      var track = $("<li>");


      var trackSong = $("<a>", {
        class: "song",
        "data-uid": val.uid
      });
      if ($.ongaku.themer.getBaseColor()){
        trackSong.css({
          color: $.ongaku.themer.getBaseColor()
        });
      }
      track.append(trackSong);

      var trackInfoNums = $("<div>", {
        class: 'track-info track-px'
      });
      var trackNumber = $("<div>", {
        class: 'track-info track-num'
      });
      var trackDuration = $("<div>", {
        class: 'track-info track-time'
      });
      trackDuration.html(val.duration);
      trackNumber.html(tracknumber);

      trackInfoNums.append(trackNumber);
      trackInfoNums.append(trackDuration);

      var trackLabels = $("<div>", {
        class: 'track-info track'
      });

      var trackTitle = $("<div>", {
        class: 'track-info track-title'
      });
      trackTitle.html(val.title);

      var trackAlbum = $("<div>", {
        class: 'track-info track-album'
      });
      trackAlbum.html(val.album);

      var trackArtist = $("<div>", {
        class: 'track-info track-artist'
      });
      trackArtist.html(val.artist);

      trackLabels.append(trackTitle);
      trackLabels.append(trackArtist);
      trackLabels.append(trackAlbum);

      trackSong.append(trackInfoNums);
      trackSong.append(trackLabels);
      return track;
    };


    $.ongaku.playlist = new Playlist();

    var shift = {
        "left": function (a) {
            a.push(a.shift());
        },
        "right": function (a) {
            a.unshift(a.pop());
        }
    };

    //Reference:
    //http://www.onextrapixel.com/2012/12/10/how-to-create-a-custom-file-input-with-jquery-css3-and-php/
		// Browser supports HTML5 multiple file?
	  var multipleSupport = typeof $('<input/>')[0].multiple !== 'undefined',
	      isIE = /msie/i.test( navigator.userAgent );

	  $.fn.customFile = function(label) {
	    return this.each(function() {
	      var $file = $(this).addClass('custom-file-upload-hidden'), // the original file input
	          $wrap = $('<div class="file-upload-wrapper">'),
	          //$input = $('<input type="text" class="file-upload-input" />'),
	          // Button that will be used in non-IE browsers
	          $button = $('<button type="button" class="file-upload-button">' + label + '</button>');
	          // Hack for IE
	          //$label = $('<label class="file-upload-button" for="'+ $file[0].id +'">Select a File</label>');

	      // Hide by shifting to the left so we
	      // can still trigger events
	      $file.css({
	        position: 'absolute',
	        left: '-9999px'
	      });

	      $wrap.insertAfter( $file )
	        .append( $file, $button );

	      // Prevent focus
	      $file.attr('tabIndex', -1);
	      $button.attr('tabIndex', -1);

	      $button.click(function () {
	        $file.focus().click(); // Open dialog
	      });
/*
	      $file.change(function() {

	        var files = [], fileArr, filename;

	        // If multiple is supported then extract
	        // all filenames from the file array
	        if ( multipleSupport ) {
	          fileArr = $file[0].files;
	          for ( var i = 0, len = fileArr.length; i < len; i++ ) {
	            files.push( fileArr[i].name );
	          }
	          filename = files.join(', ');

	        // If not supported then just take the value
	        // and remove the path to just show the filename
	        } else {
	          filename = $file.val().split('\\').pop();
	        }

	      });*/
	    });
	  }
}(jQuery);
