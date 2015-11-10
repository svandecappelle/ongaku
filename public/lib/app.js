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


    function Player() {
        this.titleScroller = new TitleScroller();
        this.titleScroller.start();
    }

    $.ongaku = new Player();

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
        console.log("start playing: ", this.current);

        $("#controls").attr("src", "/api/stream/".concat(uid));
        $("#mp3src").attr("src", "/api/stream/".concat(uid).concat(".".concat(encoding))).remove().appendTo("#controls");

        $("#controls")[0].pause();
        $("#controls")[0].load();
        $("#controls")[0].play();
        $.ongaku.audiowave.rebuild();

        if (['mp3', 'ogg', 'wav'].indexOf(encoding) === -1) {
            console.log(encoding);
            alertify.success('Transcoding...', 0);
        }

        $(".play").find("[data-uid='" + this.current + "']").parent().parent().addClass('playing');
        var title = $(".play").find("[data-uid='" + this.current + "']").parent().parent().find(".song-title").text() + " ";
        console.log("play: " + title);
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
            console.log("build audio controls");
            this.player = new MediaElementPlayer("audio", {
                volume: 0.1,
                success: function (me) {
                    console.log("musique player builded: playing starting");
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
                            console.log("need to select into playing: " + $.ongaku.getCurrent());
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
    };

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
        //this.currentHandlers["pending-song"].bind(".pending-list .list .song");
        //$('a.song').click(this.currentHandlers["song"]);
    };

    Controls.prototype.unbind = function () {
      if (this.handles){
        console.log("Controls.unbind");
        $.each(this.handles, function (index, value){
          console.log("Controls.unbind(".concat(index).concat(")"), value);
          value.unbind();
        });
      }
    }

    $.ongaku.controls = new Controls();

    function Library() {
      this.videos = [];
      this.page = 0;
      this.type = "audio";
    }

    Library.prototype.handlers = function () {
      this.handles = {
        "controller" : new HandlerRegisteration(".pending-list .controller", "click", function () {
          $('.pending-list').toggleClass("active");
        }),
        "searchbox" : new HandlerRegisteration("input.searchbox", "change", function () {
            $.ongaku.library.search($(this).val());
        }),
        "artist" : new HandlerRegisteration(".artistappend:not(.disabled)", "click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            $.ongaku.playlist.appendFromElement($(this));
        }),
        "album" : new HandlerRegisteration(".albumappend:not(.disabled)", "click", function (event) {
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
        })
      };

      return this.handles;
    };

    Library.prototype.bind = function () {
        console.log("Library.bind");
        this.unbind();
        $.each(this.handlers(), function (type, handler){
          handler.bind();
        });

        this.type = $("input.searchbox").data("type");
        /*
        $('.pending-list .controller').click(this.currentHandlers["controller"]);
        $("input.searchbox").on("change", this.currentHandlers["searchbox"]);
        $(".artistappend:not(.disabled)").on("click", this.currentHandlers["artist"]);
        $(".albumappend:not(.disabled)").on("click", this.currentHandlers["album"]);
        $(".pending-list .list").bind("mousewheel", ".jspContainer", this.currentHandlers["pending-list"]);
        $(".fa-eraser").on("click", this.currentHandlers["eraser"]);*/
        this.scrollingLoader();
    };

    Library.prototype.scrollingLoader = function () {
      if (this.libraryScrollPane){
        this.libraryScrollPane.unbind('jsp-scroll-y');
      }
      this.libraryScrollPane = $('.library-view').jScrollPane();
      this.libraryScrollPane.bind('jsp-scroll-y', function(event, scrollPositionY, isAtTop, isAtBottom) {
        console.log('Handle jsp-scroll-y', 'isAtBottom=', isAtBottom);
        if (isAtBottom){
          $.ongaku.library.fetch();
        }
      });
    };

    Library.prototype.unbind = function () {
      if (this.handles){
        console.log("Library.unbind")
        $.each(this.handles, function (index, value){
          console.log("Library.unbind(".concat(index).concat(")"));
          value.unbind();
        });
      }
    };

    Library.prototype.search = function (pattern) {
        console.log("search for: ", pattern);
        if (pattern) {
          this.searching = true;
          $.get("/api/".concat(this.type).concat("/library/filter/").concat(pattern), function (output) {
              $.ongaku.library.buildSearch(output);
          });
        } else {
          this.searching = false;
          this.page = -1;
          $.ongaku.library.clear();
          $.ongaku.library.fetch();
        }
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
        if (this.type === 'audio'){
          $.each(library, function (index, artist) {
              console.log("audio: " + index);
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

              var artistAppender = $('<a>', {class: 'artistappend'});
              var glyficonArtistAppender = $('<i>', {
                class: 'glyphicon glyphicon-plus trackaction',
                "data-placement": "left",
                "data-toggle": "tooltip",
                "data-original-title": "Add all tracks to current playlist"
              });
              artistAppender.append(glyficonArtistAppender);
              artistElement.append(artistAppender);
              $(glyficonArtistAppender).tooltip();

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

                var albumAppender = $('<a>', {class: 'albumappend'});
                var glyficonAlbumAppender = $('<i>', {
                  class: 'glyphicon glyphicon-plus trackaction',
                  "data-placement": "left",
                  "data-toggle": "tooltip",
                  "data-original-title": "Add all tracks to current playlist"
                });
                albumAppender.append(glyficonAlbumAppender);
                albumElement.append(albumAppender);
                $(glyficonAlbumAppender).tooltip();

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
                  var trackElement = $('<li>');
                  var trackDetailElement = $('<div>', {
                    class: 'track trackappend',
                    "data-uid": track.uid,
                    "data-encoding": track.encoding,
                    "data-placement": "bottom",
                    "data-toggle": "tooltip",
                    "data-original-title": "Add track to current playlist"
                  });
                  var glyficonAddLibraryAppender = $('<i>', {
                    class: 'glyphicon glyphicon-plus trackaction trackappend',
                    "data-uid": track.uid,
                    "data-encoding": track.encoding
                  });
                  var glyficonLikeAppender = $('<i>', {
                    class: 'glyphicon glyphicon-heart trackaction tracklike',
                    "data-uid": track.uid,
                    "data-encoding": track.encoding
                  });
                  trackDetailElement.html(track.title);
                  trackDetailElement.append(glyficonAddLibraryAppender);
                  trackDetailElement.append(glyficonAddLibraryAppender);

                  trackElement.append(trackDetailElement);
                  tracks.append(trackElement);

                  glyficonAddLibraryAppender.on("click", function (event) {
                      event.preventDefault();
                      event.stopPropagation();
                      $.ongaku.playlist.appendFromElement($(this));
                  });

                  trackDetailElement.on("click", function (event) {
                      event.preventDefault();
                      event.stopPropagation();
                      $.ongaku.playlist.appendFromElement($(this));
                  });

                });

                // append all songs on album
                /*tracks.on("click", function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    $.ongaku.playlist.appendFromElement($(this));
                });*/

              });

          });
        } else if (this.type === 'video'){
          //this.clear();
          if (this.searching){
            this.videoDispose();
          }

          $.each(library, function (index, video) {
            var videoElement = $('<li>', {style: "width: 494px; display: inline-block;"});
            var videoLink = $('<a>', {class: "link video"});
            var videoName = $('<div>', {class: 'name'});
            videoName.html(video.name);

            var videoHtml5 = $('<video>', {class : 'player-video video-js vjs-default-skin not-initialized', height: "270", width: "480", id : video.uid, preload: "auto", controls });
            var videoSource = $('<source>', {src : "/api/video/stream/".concat(video.uid), type : "video/".concat(video.extension)});

            videoHtml5.append(videoSource);
            videoLink.append(videoName);
            videoLink.append(videoHtml5)
            videoElement.append(videoLink);

            $(".lib.group.artist.open").append(videoElement);
          });
          this.loadVideo();
        }
        //$('').jScrollPane();
        this.scrollingLoader();

        /*$(".search-result-track").on("click", function (event) {
            $.ongaku.playlist.appendFromElement($(this));
        });*/
        /*$(".trackappend:not(.disabled)").on("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            $.ongaku.playlist.appendFromElement($(this));
        });*/

    };

    Library.prototype.fetch = function () {
      var that = this;
      if (!this.isFetchPending && !this.searching){
        this.page += 1;
        this.isFetchPending = true;
        console.log("Getting new page: " + this.page);
        $.get("/api/".concat(this.type).concat("/library/").concat(this.page), function(output){
          console.log("append lib: "+ output);
          $.ongaku.library.append(output);
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
				console.log($( this ).attr('id'));
				$(this).removeClass(".not-initialized");
        that.videos.push(videojs($( this ).attr('id'), {width: "480", height: "270"}, function(){
					// Player (this) is initialized and ready.
				}));
			})
    };

    Library.prototype.videoDispose = function () {
      if (this.videos !== null){
        $.each(this.videos, function(index, player){
  				player.dispose();
  			})
      }
      this.videos = [];
    };

    $.ongaku.library = new Library();

    function Playlist() {

    }

    Playlist.prototype.remove = function (uidFile) {
        $.post("/api/playlist/remove/".concat(uidFile), function (playlist) {
            $.ongaku.playlist.rebuild(playlist);
        });
    };

    Playlist.prototype.clear = function () {
        $.post("/api/playlist/clear", function (playlist) {
            $.ongaku.playlist.rebuild(playlist);
        });
    };

    Playlist.prototype.append = function (uidFile) {
        $.post("/api/playlist/add/".concat(uidFile), function (playlist) {
            $.ongaku.playlist.rebuild(playlist);
            if ($(".pending-list .song").length === 1) {
                $.ongaku.next();
            }
        });
    };


    Playlist.prototype.appendFromElement = function (element) {
        console.log("append from element");
        var elementsToAppend = $(element).parent().find(".track");
        if (elementsToAppend.length > 1){
          var jsonElementsAppend = [];
          $.each(elementsToAppend, function (index, value){
            jsonElementsAppend.push($(value).data("uid"));
          });
          console.log(jsonElementsAppend);
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
        if (playlist.all.length === 0) {
            $('.pending-list .list .jspPane').empty();
            $(".player").empty();
            $.ongaku.setInitialized(false);
        }

        var tracknumber = 0;

        $.each(playlist.all, function (index, val) {
            tracknumber += 1;
            var track = "\
                <li>\
                    <a class='song' data-uid='{{uid}}'>\
                        <div class='track-info track-px'>\
                            <div class='track-info track-num'>\
                                {{num}}\
                            </div>\
                            <div class='track-info track-time'>\
                                {{time}}\
                            </div>\
                        </div>\
                        <div class='track-info track'>\
                            <div class='track-info track-title'>\
                                {{title}}\
                            </div>\
                            <div class='track-info track-artist'>\
                                {{artist}}\
                            </div>\
                        </div>\
                    </a>\
                </li>";

            track = track.replace("{{uid}}", val.uid);
            track = track.replace("{{num}}", tracknumber);
            track = track.replace("{{time}}", val.duration);
            track = track.replace("{{title}}", val.title);
            track = track.replace("{{artist}}", val.artist);

            var track = $("ul.playlist").append(track);
        });

        var trackObj = playlist.lastAdded;
        if (trackObj !== undefined) {
            var track ="\
            <div class='song'>\
                <div class='layer'>\
                    <div class='top'></div>\
                    <div class='left'></div>\
                    <div class='right'></div>\
                    <div class='bottom'></div>\
                </div>\
                <div class='info'>\
                    <div class='song-title'> " + trackObj.title + "</div>\
                    <div class='song-artist'> " + trackObj.artist + "</div>\
                    <div class='song-infos'> " + trackObj.duration + "</div>\
                </div>\
                <div class='play'>\
                    <div class='button' data-uid='" + trackObj.uid + "'> Play</div>\
                </div>\
            </div>";
            $('.pending-list .list .jspPane').append(track);

            var audioControls = "<audio id='controls' controls='controls' width='100%'></audio>";

            var source = "<source id='mp3src' type='audio/"+ trackObj.encoding +"' src='/api/stream/" + trackObj.uid + "."+ trackObj.encoding +"'></source>";
            if (!$.ongaku.isInitialised()) {
                console.log("first song:: need to build controls");
                $(".player").empty();
                $(".player").show();
                $(".player").html(audioControls);
                $(".player > audio").html(source);
                $.ongaku.build(function () {
                    $.ongaku.next();
                });
            }
        }

        $.ongaku.controls.bind();
        $('.scroll-pane').jScrollPane();
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
