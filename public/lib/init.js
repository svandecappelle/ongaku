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

function Connection(opts){
  this.opts = opts;
}

Connection.prototype.notify = function (id, opts) {
  iziToast.show({
    close: opts.close !== undefined ? opts.close : true,
    position: 'topCenter',
    id: id,
    message: opts.message,
    transitionIn: 'flipInX',
    transitionOut: 'flipOutX',
    progressBarColor: 'rgb(0, 255, 184)',
    // image: '/img/album.jpg',
    // imageWidth: 70,
    layout: 2,
    timeout:  opts.close !== undefined ? opts.close : true,
    icon: 'icon-contacts',
    title: 'Notification',
    iconColor: 'rgb(0, 255, 184)',
    color: 'dark',
  });
};

Connection.prototype.bind = function () {
  var that = this;
  this.socket = io();

  $.chat.init(that.socket, $.ongaku.getUser().username);
  this.socket.on('connected', function () {
    if ($.ongaku.getUser().username){
      that.socket.emit('room:join', $.ongaku.getUser().username);
      that.socket.emit('room:join', that.opts.session.sessionID);
    } else {
      that.socket.emit('room:join', that.opts.session.sessionID);
    }
  });

  this.socket.on('notification', function (data) {
    that.notify("application-message", data);
  });

  this.socket.on('application:connected', function () {
    var location = window.location.href;
    ev.location = location;
    that.notify("application-message", ev);
  });

  this.socket.on('desktop-playing:started', function (obj) {
    console.log("plays started", obj);
    $.ongaku.setWaveform(obj.uuid);
  });

  this.socket.on('streaming-playing:started', function (obj) {
    if ($.ongaku.getCurrent() !== obj.uuid) {
      $.ongaku.setCurrent(obj.uuid, obj.encoding, true);
      that.notify("application-message", 'Another tab is streaming media.', '');
    }
  });

  this.socket.on('desktop-playing:playing', function (obj) {
    console.log("playing", obj);
  });

  this.socket.on('library:scanned', function () {
    $("#finished-loading-library").remove();
    $("#progress-loading-message").remove();
    that.notify('finished-loading-library', "Library was reloaded:", '<a href="/">click here to refresh</a>');
  });
  this.socket.on('library:scanner:progress', function(ev){
    if (ev.value >= 100) {
      $("#finished-loading-library").remove();
      $("#progress-loading-message").remove();
      that.notify('finished-loading-library', {
        message: 'Library was reloaded: <a href="/">click here to refresh</a>'
      });
    } else {
      if ($("#progress-loading-message").length === 0){
        that.notify('progress-loading-message', ev);
      }
      $("#progress-loading-message .iziToast-body p.slideIn").html('Reloading library: <div class="progress" style="min-width: 300px; height: 10px;"><div class="progress-bar progress-bar-info progress-bar-striped active" style="width: ' + ev.value + '%"></div></div>');
    }
  });
};

function initApplication(opts){
  $.ongaku.setUser(opts.user);
  $.ongaku.setProperties(opts.meta);
  $.ongaku.library.setGroupBy(opts.session.groupby);
  console.log(opts.session);

  $(function () {
    $('#responsive-menu').on('click', function(){
      // $("#header").toggleClass("show");
      $("nav.menu").toggleClass("show");
      $("body").toggleClass("cannot-scroll");
      new Sticky('section.song-list > .list-container .playlist-columns');
    });
    $.ongaku.playlist.bind();
    $.ongaku.playlist.fetch();
  });

  videojs.options.flash.swf = "http://" + opts.session.host + "/video-js/video-js.swf";

  // var basecolor = Cookies.get("base-color");
  //if (basecolor){
  //  $.ongaku.themer.setBaseColor(basecolor);
  //} else {
    $.ongaku.themer.setBaseColor(opts.theme['base-color']);
  //}
  $("#base-color").spectrum({
    color: opts.theme['base-color'],
    "body": "input.colorpicker",
    "showAlpha": false,
    "preferredFormat": "rgb",
    move: function(color) {
      $.ongaku.themer.setBaseColor(color.toRgbString());
    },
    change: function(color){
      $.post('/api/set-color-scheme', {color: color.toRgbString()});
    }
  });

  $('[data-toggle="popover"]').popover();
  $('[data-toggle="tooltip"]').tooltip();
  $('.scroll-pane').jScrollPane();
  $.ongaku.build();
  $.ongaku.controls.bind();

  var connection = new Connection(opts);
  connection.bind();

  $(".nav-reload>a").on("click", function(){
    $.get("/api/reload/audio/library", function(output){
      // $.ongaku.library.rebuild(output, "audio");
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
