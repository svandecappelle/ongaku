+function ($) {
    'use strict';

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

    Player.prototype.isAnonymous = function () {
      return this.user === undefined;
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

        $(".playing").removeClass('playing');
        this.current = uid;

        $("#controls").attr("src", "/api/stream/".concat(uid));
        $("#mp3src").attr("src", "/api/stream/".concat(uid).concat(".".concat(encoding))).remove().appendTo("#controls");

        $("#controls")[0].pause();
        $("#controls")[0].load();
        $("#controls")[0].play();
        $.ongaku.audiowave.rebuild();

        if (['mp3', 'ogg', 'wav'].indexOf(encoding) === -1) {
            alertify.success('Transcoding...', 0);
        }

        $(".play").find("[data-uid='" + this.current + "']").parent().parent().addClass('playing');
        $(".list-container").find("[data-uid='" + this.current + "']").addClass('playing');

        var title = $(".play").find("[data-uid='" + this.current + "']").parent().parent().find(".song-title").text() + " ";
        this.titleScroller.configure({
            text: title,
            speed: 500,
            forceReset: true
        });
    };

    Player.prototype.stop = function (uid, encoding) {
        $("#controls")[0].stop();
    };

    Player.prototype.getPlayer = function () {
      return this.player;
    };

    Player.prototype.build = function (callback) {
        if ($('.player > audio').children().length > 0 && !this.isInitialised()) {
            this.initialised = true;
            this.player = new MediaElementPlayer("audio", {
                volume: 0.1,
                features: ['playpause','progress','current','duration','tracks','volume','fullscreen'],
                success: function (me) {
                    me.addEventListener('loadedmetadata', function () {
                        alertify.dismissAll();
                    });
                    me.addEventListener('ended', function () {
                        $.ongaku.next();
                    });
                    me.addEventListener('play', function () {
                        //$.ongaku.getPlayer.volume = 1;
                        if ($.ongaku.isFirst()) {
                            alertify.warning('Add a track to play', 2);
                            $.ongaku.stop();
                        } else if ( $(".playing").length === 0) {
                            $(".play").find("[data-uid='" + $.ongaku.getCurrent() + "']").parent().parent().addClass('playing');
                        }
                    });
                    if (callback !== undefined) {
                        callback();
                    }
                },
                error: function (me) {
                    console.log("failure build musique player:", me);
                }
            });

            $('.player').height("30px");
            $('.player > audio').show();
        } else {
            this.initialised = false;
            $('.player').height("30px");
            $('.player').css("background-color", "black");
            $('.player>audio').hide();
        }
    };

    Player.prototype.isInitialised = function () {
        return this.initialised;
    };

    Player.prototype.setInitialized = function (initialised) {
        this.initialised = initialised;
    };

    Player.prototype.next = function () {
        var nextSong = null;
        if (this.current) {
            nextSong = $(".play").find("[data-uid='" + this.current + "']").parent().parent().next();
        } else {
            nextSong = $(".play>.button").first().parent().parent();
        }

        console.log("Start next song: ", this.current);

        if (nextSong) {
            var nextUid = nextSong.find(".button").data('uid'),
                encoding = nextSong.find(".button").data('encoding');
            if (nextUid) {
                this.play(nextUid, encoding);
            }
        }
    };

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
        "pending-song": new HandlerRegisteration(".pending-list .list .song", "click", function () {
            $.ongaku.play($(this).find(".button").data("uid"), $(this).find(".button").data("encoding"));
        }),
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

    function MetadataLabel(title, value){
      var label = $("<tr>", {
        "class": "metadata"
      }),
        titleObj = $("<td>", {
          "class": "mt-title"
        }),
        valueObj = $('<td>'),
        valueLabel = $('<div>', {
          "class": "mt-value"
        });

      titleObj.html(title);
      valueObj.append(valueLabel);
      valueLabel.html(value);
      label.append(titleObj);
      label.append(valueObj);
      return label;
    }

    function MetadatasArray(metadatas){
      var container = $('<div>', {
        "class": "mt-array"
      });
      var array = $(document.createElement('table'));
      $.each(metadatas, function(index, value){
        array.append(new MetadataLabel(index, value));
      });
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
        "data-placement": "left",
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
        "data-placement": "left",
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

    function Library() {
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
        "pending-list": new HandlerRegisteration(".pending-list .list", "mousewheel", function (event, delta) {
            var leftPos = $('.pending-list .list .jspPane').position().left;
            leftPos += (delta * 70);
            $(".pending-list .list .jspPane").css({left : leftPos});
            event.preventDefault();
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
      console.log("bind", new Error());
        this.view = view;
        this.unbind();
        $.each(this.handlers(), function (type, handler){
          handler.bind();
        });

        this.type = $("input.searchbox").data("type");
        this.scrollingLoader();
    };

    Library.prototype.scrollingLoader = function () {
      if (this.libraryScrollPane){
        this.libraryScrollPane.unbind('jsp-scroll-y');
      }
      this.libraryScrollPane = $('.library-view').jScrollPane();

      this.libraryScrollPane.bind('jsp-scroll-y', function(event, scrollPositionY, isAtTop, isAtBottom) {
        // For asynchronous loading debug
        // console.log('Handle jsp-scroll-y', 'isAtBottom=', isAtBottom);
        if (isAtBottom){
          $.ongaku.library.fetch();
        }
      });
    };

    Library.prototype.unbind = function () {
      if (this.handles){
        $.each(this.handles, function (index, value){
          value.unbind();
        });
      }
    };

    Library.prototype.search = function (pattern) {
        console.log("search for: ", pattern);
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

    Library.prototype.append = function (library) {
      var that = this;
      if (this.type === 'audio'){
        $.each(library, function (index, artist) {
            // For asynchronous loading debug
            // console.log("audio: " + index);
            var artistElement = $('<li>');

            $(".lib.group.artist.open").append(artistElement);

            var artistDetailElement = $("<a>", {
              class: 'link'
            });
            var artistImage = $('<img>', {class: 'artist', src: artist.image});
            var artistName = $('<span>', {class: 'artistname'});
            artistName.html(artist.artist);
            artistDetailElement.append(artistImage);
            artistDetailElement.append(artistName);
            artistElement.append(artistDetailElement);

            var artistAppender = $('<a>', {
              class: 'trackaction',
              "data-placement": "left",
              "data-toggle": "tooltip",
              "data-original-title": "Add all tracks to current playlist"
            });
            var glyficonArtistAppender = $('<i>', {
              class: 'glyphicon glyphicon-plus',
            });

            artistAppender.append(glyficonArtistAppender);

            artistElement.append(artistAppender);
            if (!$.ongaku.isAnonymous()){
              if (that.view){
                new UserLib().remover(artistElement);
              } else {
                new UserLib().appender(artistElement);
              }
            }

            $(artistAppender).tooltip();

            artistAppender.on("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                $.ongaku.playlist.appendFromElement($(this));
            });

            var artistAlbums = $('<ul>', {class: "group album"});
            artistElement.append(artistAlbums);

            $.each(artist.albums, function(title, album){
              var albumElement = $('<li>');
              var tracks = $('<ul>', {class: "group tracklist"});
              var albumDetailElement = $("<a>", {class: 'link'});
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

              albumAppender.append(glyficonAlbumAppender);
              albumElement.append(albumAppender);
              if (!$.ongaku.isAnonymous()){
                if (that.view){
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

              albumTitle.html(album.title);
              albumDetailElement.append(albumImage);
              albumDetailElement.append(albumTitle);
              albumElement.append(albumDetailElement);
              artistAlbums.append(albumElement);
              albumElement.append(tracks);

              $.each(album.tracks, function(index, track){
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
                  if (that.view){
                    new UserLib().remover(trackDetailElement);
                  } else {
                    new UserLib().appender(trackDetailElement);
                  }
                }

                if (!$.ongaku.isAnonymous()){
                  var glyficonLikeAppender = $('<i>', {
                    class: 'glyphicon glyphicon-heart trackaction tracklike'
                  });
                  trackDetailElement.append(glyficonLikeAppender);
                }

                var trackShowDetail = $('<a>', {
                  "role": "button",
                  "tabindex": "0",
                  "data-placement": "auto bottom",
                  "data-toggle": "popover",
                  "title": "Track metadatas"
                });
                var glyphShowDetail = $('<i>', {
                  "class": 'glyphicon glyphicon-info-sign trackaction metadata-track',
                });
                trackShowDetail.append(glyphShowDetail);
                $(trackShowDetail).popover({
                  "trigger": "focus",
                  "html": true,
                  "container": 'body',
                  "content": new MetadatasArray(track.metadatas).html()
                });
                trackElement.append(trackShowDetail);

                trackElement.append(trackDetailElement);
                tracks.append(trackElement);

                $(trackDetailElement).tooltip();

                trackDetailElement.on("click", function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    $.ongaku.playlist.appendFromElement($(this));
                });
              });
            });

        });
      } else if (this.type === 'video'){
        //this.clear();
        if (this.searching){
          this.videoDispose();
        }

        $.each(library, function (index, video) {
          var videoElement = $('<li>', {
            style: "width: 494px; display: inline-block;"
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
            height: "270",
            width: "480",
            id : video.uid,
            preload: "auto",
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
        that.videos.push(videojs($( this ).attr('id'), {width: "480", height: "270"}, function(){
					// Player (this) is initialized and ready.
				}));
			});
    };

    Library.prototype.videoDispose = function () {
      if (this.videos !== null){
        $.each(this.videos, function(index, player){
  				player.dispose();
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
          if ($(".pending-list .song").length === 1) {
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

                if ($(".pending-list .song").length === 1) {
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

      $('.pending-list .list .jspPane').empty();
      if (playlist && playlist.all) {
        if (playlist.all.length === 0){
          $('.pending-list .list .jspPane').empty();
          $(".player").empty();
          $.ongaku.setInitialized(false);
        }

        if (playlist.name){
          $("#playlistname").val(playlist.name);
        }

        var tracknumber = 0;

        $.each(playlist.all, function (index, val) {
            tracknumber += 1;
            $("ul.playlist").append(new Track(tracknumber, val));
            $('.pending-list .list .jspPane').append(new PendingTrack(val));
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
            $(".player").empty();
            $(".player").show();
            $(".player").html(audioControls);
            $(".player > audio").html(source);
            $.ongaku.build(function () {
                $.ongaku.next();
            });
        } else {
          $(".list-container").find("[data-uid='".concat($.ongaku.getCurrent()).concat("']")).addClass('playing');
        }
      } else {
        $('.pending-list .list .jspPane').empty();
        $(".player").empty();
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
        "controller" : new HandlerRegisteration(".pending-list .controller", "click", function () {
          $('.pending-list').toggleClass("active");
        }),
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

      var trackArtist = $("<div>", {
        class: 'track-info track-artist'
      });
      trackArtist.html(val.artist);

      trackLabels.append(trackTitle);
      trackLabels.append(trackArtist);

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

}(jQuery);
