+function ($) {
	'use strict';

	function Player(){

	};

	$.ongaku = new Player();

	Player.prototype.play = function(uid){
		$("#controls").attr("src", "/stream/".concat(uid));
		$("#mp3src").attr("src", "/stream/".concat(uid)).remove().appendTo("#controls");
		$("#controls")[0].pause();
		$("#controls")[0].load();
		$("#controls")[0].play();
	};

	function Controls(){

	};

	Controls.prototype.bind = function(){
		$(".play .button").click(function(){
			$.ongaku.play($(this).data("uid"));
		});
		$('a.song').click(function(){
			$.ongaku.play($(this).data("uid"));
		});
	};

	$.ongaku.controls = new Controls();

}(jQuery);