+function ($) {
	'use strict';

	function Player(){

	}

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
		var title = $(".play").find("[data-uid='" + this.current + "']").parent().parent().find(".song-title").text();
		console.log("play: " + title);
		$.marqueeTitle({
			text: "Ongaku - Playing: " + title,
			dir: "left",
			speed: 500
		});
	};

	Player.prototype.stop = function(uid, encoding){
		$("#controls")[0].stop();
	};

	Player.prototype.build = function() {
		
		console.log("build audio controls");
		$('video,audio').mediaelementplayer({
			success: function (me) {
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
			},
			failure: function(me){
				console.log(me);
			}
		});
	
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
			if (this.current === undefined){
				console.log("first song:: need to build controls");
				$.ongaku.build();
			}
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
			
				var audioControls = "<audio id='controls' controls='controls' src='/stream/" + trackObj.uid + "' width='100%'><source id='mp3src' type='audio/mp3' src='/stream/" + trackObj.uid + "'></audio>";
				if ($.ongaku.isFirst()){
					$(".notrackplaying").remove();
					$.ongaku.next();
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
    
    $.marqueeTitle = function (options) {
        var opts = $.extend({},
        {
            text: "",
            dir: "left",
            speed: 200,
            wait: 1000,
        }, options),
            t = (opts.text || document.title).split("");
        if (!t) {
            return;
        }
        t.push(" ");
		document.title = t;
		/*setTimeout(function () {
			titleScroller(t.substr(1) + t.substr(0, 1));
		}, 500);*/
	};
}(jQuery);