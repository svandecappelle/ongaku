+function ($) {
	'use strict';

	function TitleScroller(){
    	this.appearCharLenghtLimit = 16;
    	this.options = {};
    };
    
    TitleScroller.prototype.configure = function(opts){
		var that = this;

    	this.stop(function(){
    		that.turn = 1;
    	
			that.options = $.extend({
				prefix: "Ongaku: ",
				text: undefined,
				speed: 200,
				wait: 2000
			}, opts);
			document.title = that.options.prefix + that.options.text;
			that.currentTitle = that.options.text;
			if (that.appearCharLenghtLimit < that.options.text.length){
				that.start();
			}
    	});
		
    };

    TitleScroller.prototype.stop = function (callback) {
    	var that = this;
		that.stopFlag = true;
    	setTimeout(function(){
			that.stopFlag = false;
			callback();
		}, this.options.wait);
    };

    TitleScroller.prototype.start = function () {
		var that = this;
		if (that.options.text !== undefined){
			that.currentTitle = that.currentTitle.substring(1, that.currentTitle.length) + that.currentTitle.substring(0, 1);
			document.title = that.options.prefix + that.currentTitle;
			setTimeout(function(){

				if (that.stopFlag){
					that.stopFlag = false;
				}else{
					if (that.turn === that.currentTitle.length){
						that.turn = 1;
						setTimeout(function(){
							that.start();
						}, that.options.wait);
					}else{
						that.turn += 1;
						that.start();
					}
				}
			}, that.options.speed);
		}
	};


	function Player(){
		this.titleScroller = new TitleScroller();
		this.titleScroller.start();
	};

	$.ongaku = new Player();

	Player.prototype.isFirst = function() {
		return this.current === undefined;
	};

	Player.prototype.setCurrent = function(currentId) {
		this.current = currentId;
	};

	Player.prototype.getCurrent = function() {
		return this.current;
	};

	Player.prototype.play = function(uid, encoding){

		$(".playing").removeClass('playing');
		this.current = uid;
		console.log("start playing: ", this.current);
		
		$("#controls").attr("src", "/stream/".concat(uid));
		$("#mp3src").attr("src", "/stream/".concat(uid)).remove().appendTo("#controls");

		$("#controls")[0].pause();
		$("#controls")[0].load();
		$("#controls")[0].play();

		if (encoding !== 'mp3'){
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

	Player.prototype.stop = function(uid, encoding){
		$("#controls")[0].stop();
	};

	Player.prototype.build = function(callback) {
		if ($('.player > audio').children().length > 0 && !this.isInitialised()){
			this.initialised = true;
			console.log("build audio controls");
			$('audio').mediaelementplayer({
				success: function (me) {
					console.log("musique player builded: playing starting");
					me.addEventListener('loadedmetadata', function () {
						alertify.dismissAll();
					});
					me.addEventListener('ended', function () {
						$.ongaku.next();
					});
					me.addEventListener('play', function(){
						if ($.ongaku.isFirst()){
							alertify.warning('Add a track to play', 2);
							$.ongaku.stop();
						}else if($(".playing").length === 0){
							console.log("need to select into playing: " + $.ongaku.getCurrent());
							$(".play").find("[data-uid='" + $.ongaku.getCurrent() + "']").parent().parent().addClass('playing');
						}
					});
					if (callback !== undefined){
						callback();
					}
				},
				error: function(me){
					console.log("failure build musique player:", me);
				}
			});
			
			$('.player').height("30px");
			$('.player > audio').show();
		}else{
			this.initialised = false;
			$('.player').height("30px");
			$('.player').css("background-color", "black");
			$('.player>audio').hide();
		}
	};

	Player.prototype.isInitialised = function() {
		return this.initialised;
	};

	Player.prototype.next = function(){		
		var nextSong = null;
		if (this.current){
			nextSong = $(".play").find("[data-uid='" + this.current + "']").parent().parent().next();
		}else{
			nextSong = $(".play>.button").first().parent().parent();
		}
		
		console.log("Start next song: ", this.current);

		if (nextSong){
			var nextUid = nextSong.find(".button").data('uid');
			var encoding = nextSong.find(".button").data('encoding');
			if (nextUid){
				this.play(nextUid, encoding);
			}
		}
	};

	function Controls(){

	}

	Controls.prototype.bind = function(){
		$(".pending-list .list .song").click(function(){
			$.ongaku.play($(this).find(".button").data("uid"), $(this).find(".button").data("encoding"));
		});

		$('a.song').click(function(){
			$.ongaku.play($(this).data("uid"), $(this).data("encoding"));
		});
	};

	$.ongaku.controls = new Controls();

	function Library (){

	}

	Library.prototype.bind = function() {
		console.log("bind library");
		$(".group>li").on("click", function(event){
			event.preventDefault();
			event.stopPropagation();
			$(this).toggleClass("detail");
			$(this).children("ul.group").toggleClass("open");
			$('.scroll-pane').jScrollPane();
		});

		var that = this;
		$("input.searchbox").on("change", function(){
			that.search($(this).val());
		});

		$(".artistappend").on("click", function(event){
			event.preventDefault();
			event.stopPropagation();
			$.ongaku.playlist.appendFromElement($(this));
		});
		
		$(".albumappend").on("click", function(event){
			event.preventDefault();
			event.stopPropagation();
			$.ongaku.playlist.appendFromElement($(this));
		});

		$(".pending-list .list").bind("mousewheel", ".jspContainer", function(event, delta) {
			var leftPos = $('.pending-list .list .jspPane').position().left;
			leftPos += (delta * 70);
			$(".pending-list .list .jspPane").css({left : leftPos});
			event.preventDefault();
		});
	};

	Library.prototype.search = function(pattern) {
		console.log("search for: ", pattern);
		$(".track").each(function(){
			if ($(this).text().toLowerCase().lastIndexOf(pattern.toLowerCase()) !== -1){
				$(this).show();
				console.log($(this).text());
			}else{
				$(this).hide();
			}
		});
	};

	$.ongaku.library = new Library();

	function Playlist (){

	}
	
	Playlist.prototype.remove = function(uidFile) {
		$.post("/playlist/remove/".concat(uidFile), function(playlist){
			$.ongaku.playlist.rebuild(playlist);
		});
	};

	Playlist.prototype.append = function(uidFile) {
		$.post("/playlist/add/".concat(uidFile), function(playlist){
			$.ongaku.playlist.rebuild(playlist);
		});
	};


	Playlist.prototype.appendFromElement = function(element) {
		$(element).parent().find(".track").each(function(id, track){
			console.log(track);
			$.ongaku.playlist.append($(track).data("uid"));
		});
	};

	Playlist.prototype.rebuild = function(playlist) {
		$("ul.playlist").empty();
			var tracknumber = 0;

			$.each(playlist.all, function(index, val){
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
			if (trackObj !== undefined){
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
			
				var audioControls = "<audio id='controls' controls='controls' src='/stream/" + trackObj.uid + ".mp3' width='100%'></audio>";
				var source = "<source id='mp3src' type='audio/mp3' src='/stream/" + trackObj.uid + ".mp3'></source>";
				if (!$.ongaku.isInitialised()){
					console.log("first song:: need to build controls");
					$(".player").empty();
					$(".player").show();
					$(".player").html(audioControls);
					$(".player > audio").html(source);
					$.ongaku.build(function(){
						$.ongaku.next();
					});
				}
				$('.scroll-pane').jScrollPane();
			}
			
			$.ongaku.controls.bind();
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