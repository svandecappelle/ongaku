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
        $("#mp3src").attr("src", "/api/stream/".concat(uid)).remove().appendTo("#controls");

        $("#controls")[0].pause();
        $("#controls")[0].load();
        $("#controls")[0].play();

        if (encoding !== 'mp3') {
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

    function Controls() {

    }

    Controls.prototype.bind = function () {
        $(".pending-list .list .song").click(function () {
            $.ongaku.play($(this).find(".button").data("uid"), $(this).find(".button").data("encoding"));
        });

        $('a.song').click(function () {
            $.ongaku.play($(this).data("uid"), $(this).data("encoding"));
        });

        $.ongaku.audiowave.rebuild();
    };

    $.ongaku.controls = new Controls();

    function Library() {
      this.videos = [];
    }

    Library.prototype.bind = function () {
        console.log("bind library");

        var that = this;

        $('.pending-list .controller').click( function () {
          $('.pending-list').toggleClass("active");
        });

        $("input.searchbox").on("change", function () {
            that.search($(this).val(), $(this).data("type"));
        });

        $(".artistappend:not(.disabled)").on("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            $.ongaku.playlist.appendFromElement($(this));
        });

        $(".albumappend:not(.disabled)").on("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            $.ongaku.playlist.appendFromElement($(this));
        });

        $(".pending-list .list").bind("mousewheel", ".jspContainer", function (event, delta) {
            var leftPos = $('.pending-list .list .jspPane').position().left;
            leftPos += (delta * 70);
            $(".pending-list .list .jspPane").css({left : leftPos});
            event.preventDefault();
        });

        $(".fa-eraser").on("click", function(){
            $.ongaku.playlist.clear();
        });
    };

    Library.prototype.search = function (pattern, type) {
        console.log("search for: ", pattern);
        var that = this;
        if (pattern) {
          $.get("/api/".concat(type).concat("/library/filter/").concat(pattern), function (output) {
              that.buildSearch(output, type);
          });
        } else {
          $.get("/api/".concat(type).concat("/library"), function (output) {
              that.rebuild(output, type);
          });
        }
    };

    Library.prototype.buildSearch = function (library, type) {
      $(".lib.group.artist.open").empty();
      $(".lib.group.artist.open").addClass("search-results");
      this.rebuild(library, type);
    };

    Library.prototype.rebuild = function (library, type) {
        $(".lib.group.artist.open").empty();
        var tracknumber = 0;

        if (type === 'audio'){
          $.each(library, function (index, artist) {
              tracknumber += 1;
              var artistElement = $('<li>');
              var artistAlbums = $('<ul>', {class: "group album"});
              var artistDetailElement = $("<a>", {
                class: 'link'
              });
              var artistImage = $('<img>', {class: 'artist', src: artist.image});
              var artistName = $('<span>', {class: 'artistname'});
              artistName.html(artist.artist);
              artistDetailElement.append(artistImage);
              artistDetailElement.append(artistName);
              artistElement.append(artistDetailElement);
              artistElement.append(artistAlbums);

              $.each(artist.albums, function(title, album){
                var albumElement = $('<li>');
                var tracks = $('<ul>', {class: "group tracklist"});
                var albumDetailElement = $("<a>", {class: 'link'});
                var albumImage = $('<img>', {class: 'album', src: album.cover});
                var albumTitle = $('<span>', {class: 'albumtitle'});
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
                    "data-uid": track.uid
                  });
                  trackDetailElement.html(track.title);
                  trackElement.append(trackDetailElement);
                  tracks.append(trackElement);
                });
              });

              $(".search-results").append(artistElement);
          });
        } else if (type === 'video'){
          this.videoDispose();
          $.each(library, function (index, video) {
            var videoElement = $('<li>', {style: "width: 494px; display: inline-block;"});
            var videoLink = $('<a>', {class: "link video"});
            var videoName = $('<div>', {class: 'name'});
            videoName.html(video.name);

            var videoHtml5 = $('<video>', {class : 'player-video video-js vjs-default-skin', height: "270", width: "480", id : video.uid, preload: "auto", controls });
            var videoSource = $('<source>', {src : "/api/video/stream/".concat(video.uid), type : "video/".concat(video.extension)});

            videoHtml5.append(videoSource);
            videoLink.append(videoName);
            videoLink.append(videoHtml5)
            videoElement.append(videoLink);

            $(".search-results").append(videoElement);
          });
          this.loadVideo();
        }
        $('.scroll-pane').jScrollPane();

        /*$(".search-result-track").on("click", function (event) {
            $.ongaku.playlist.appendFromElement($(this));
        });*/
        $(".trackappend:not(.disabled)").on("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            $.ongaku.playlist.appendFromElement($(this));
        });

    };

    Library.prototype.loadVideo = function () {
      if (this.videos === null){
        this.videos = [];
      }

      var that = this;
      $("video").each(function(){
				console.log($( this ).attr('id'));
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
            console.log($(".pending-list .song"));
            if ($(".pending-list .song").length === 1) {
                $.ongaku.next();
            }
        });
    };


    Playlist.prototype.appendFromElement = function (element) {
        $(element).parent().find(".track").each(function (id, track) {
            console.log(track);
            $.ongaku.playlist.append($(track).data("uid"));
        });
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
