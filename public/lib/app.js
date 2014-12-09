+function ($) {
	'use strict';

	function Player(){

	};

	$.ongaku = new Player();

	Player.prototype.play = function(uid){
		$(".playing").removeClass('playing');
		this.current = uid;

		$("#controls").attr("src", "/stream/".concat(uid));
		$("#mp3src").attr("src", "/stream/".concat(uid)).remove().appendTo("#controls");
		$("#controls")[0].pause();
		$("#controls")[0].load();
		$("#controls")[0].play();

		$(".play").find("[data-uid='" + this.current + "']").parent().parent().addClass('playing');
	};

	Player.prototype.next = function(){		
		var nextSong = $(".play").find("[data-uid='" + this.current + "']").parent().parent().next();
		if (nextSong){
			var nextUid = nextSong.find(".button").data('uid');
			if (nextUid){
				this.play(nextUid);
			}
		}
	};

	function Controls(){

	};

	Controls.prototype.bind = function(){
		$(".pending-list .list .song").click(function(){
			console.log('plau');
			console.log($(this).find(".button"));
			$.ongaku.play($(this).find(".button").data("uid"));
		});

		$('a.song').click(function(){
			$.ongaku.play($(this).data("uid"));
		});
	};

	$.ongaku.controls = new Controls();

}(jQuery);