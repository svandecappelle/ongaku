function processAjaxData(idContent, html, urlPath){
  $(idContent).html(html);
}

function loadView(ev, view){
  ev.preventDefault();
  //ev.stopPropagation();
  $.get("/api/view/".concat(view), function(html){
    processAjaxData(".main-content", html, view);
    window.history.pushState(view, "", "/".concat(view));
    $('.dropdown-toggle').dropdown();
    if (initView){
      initView();
    }
  });
}

function initApplication(opts){
  $.ongaku.setUser(opts.user);
  $.ongaku.setProperties(opts.meta);
  $.ongaku.library.setGroupBy(opts.session.groupby);
  $(function () {
    $('#responsive-menu').on('click', function(){
      $("#header").toggleClass("show");
      $("nav.menu").toggleClass("show");
      $("body").toggleClass("cannot-scroll");
      new Sticky('section.song-list > .list-container .playlist-columns');
    });
    $.ongaku.playlist.bind();
    $.ongaku.playlist.fetch();
  });

  videojs.options.flash.swf = "http://" + opts.session.host + "/video-js/video-js.swf";


  var basecolor = Cookies.get("base-color");
  if (basecolor){
    $.ongaku.themer.setBaseColor(basecolor);
  } else {
    $.ongaku.themer.setBaseColor(opts.theme['base-color']);
  }
  $("#base-color").spectrum({
    color:  basecolor ? basecolor : opts.theme['base-color'],
    "body": "input.colorpicker",
    "showAlpha": false,
    "preferredFormat": "rgb",
    move: function(color) {
      $.ongaku.themer.setBaseColor(color.toRgbString());
    }
  });

  $('[data-toggle="popover"]').popover();
  $('[data-toggle="tooltip"]').tooltip();
  $('.scroll-pane').jScrollPane();
  $.ongaku.build();
  $.ongaku.controls.bind();
  var socket = io.connect('http://' + opts.session.host + '/');
  socket.on('connect', function () {
      console.log("Connected");
      $.chat.init(socket, $.ongaku.getUser().username);
  });

  socket.on('desktop-playing:started', function (obj) {
      console.log("plays started", obj);
      $.ongaku.setWaveform(obj.uuid);
  });

  socket.on('desktop-playing:playing', function (obj) {
      console.log("playing", obj);
  });

  socket.on('library:scanned', function () {
    $("#finished-loading-library").remove();
    iziToast.show({
      close: false,
      position: 'topCenter',
      id: 'finished-loading-library',
      message: '<a href="/">Library was reloaded: click here to refresh</a>',
      transitionIn: 'flipInX',
      transitionOut: 'flipOutX',
      progressBarColor: 'rgb(0, 255, 184)',
      image: '/img/album.jpg',
      imageWidth: 70,
      layout:2,
      timeout: false,
      icon: 'icon-contacts',
      title: 'Library is loading:',
      iconColor: 'rgb(0, 255, 184)',
      color: 'dark',
    });
  });
  socket.on('library-scanner:progress', function(ev){
    if (ev.value >= 100){
      $("#finished-loading-library").remove();
      iziToast.show({
        close: false,
        id: 'finished-loading-library',
        position: 'topCenter',
        message: '<a href="/">Library was reloaded: click here to refresh</a>',
        transitionIn: 'flipInX',
        transitionOut: 'flipOutX',
        progressBarColor: 'rgb(0, 255, 184)',
        image: '/img/album.jpg',
        imageWidth: 70,
        layout:2,
        timeout: false,
        icon: 'icon-contacts',
        title: 'Library is loading:',
        iconColor: 'rgb(0, 255, 184)',
        color: 'dark',
      });
    }
    if ($("#progress-loading-message").length === 0){
      iziToast.show({
        close: false,
        position: 'topCenter',
        id: 'progress-loading-message',
        message: '<div class="progress" style="min-width: 300px; height: 10px;"><div class="progress-bar progress-bar-info progress-bar-striped active" style="width: ' + ev.value + '%"></div></div>',
        transitionIn: 'flipInX',
        transitionOut: 'flipOutX',
        progressBarColor: 'rgb(0, 255, 184)',
        image: '/img/album.jpg',
        imageWidth: 70,
        layout:2,
        timeout: false,
        color: 'dark',
        icon: 'icon-contacts',
        title: 'Library is loading:',
        iconColor: 'rgb(0, 255, 184)'
      });
    }
    $("#progress-loading-message .iziToast-body p.slideIn").html('<div class="progress" style="min-width: 300px; height: 10px;"><div class="progress-bar progress-bar-info progress-bar-striped active" style="width: ' + ev.value + '%"></div></div>');
  });

  $(".nav-reload>a").on("click", function(){

    var message = $("<h1>", {
      class: "message"
    });
    message.append($("<i>", {
      class: "fa fa-circle-o-notch fa-spin"
    }));
    var loadingText = $("<span>", {
      class: "text"
    });
    message.append(loadingText);
    loadingText.html("Reloading library");
    $(".sidebar.show").append(message);

    $.get("/api/reload/audio/library", function(output){
      $(".sidebar.show>.message").remove();
      $.ongaku.library.rebuild(output, "audio");
    });
  });
  $("a.view").on("click", function(ev){
    loadView(ev, $(this).data("view"));
    $("#header").removeClass("show");
    $("nav.menu").removeClass("show");
  });

  // Revert to a previously saved state
  window.addEventListener('popstate', function(event) {
    var view = event.state !== null ? event.state : "audio";
    $.get("/api/view/".concat(view), function(html){
      processAjaxData(".main-content", html, view);
      if (initView){
        initView();
      }
    });
  });

  $('#language-chooser .language').on('click', function(){
    var lang = $(this).data('locale');
    $.post('/user/set-locale', {
      lang: lang
    }, function(response){
      if (response.status === 200){
        window.location.reload();
      }
    });
  });
}
