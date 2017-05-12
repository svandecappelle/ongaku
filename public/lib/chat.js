+function ($) {
    'use strict';

    function ChatPanel(message){
      this.id = message.from.replace(".", "-");
      this.panel = $("<div>", {
        class: "chat-panel tab-pane",
        id: this.id
      });

      this.messageBox = $("<div>", {
        class: "message-inbox"
      });

      this.allMessages = $("<div>");
      this.messageBox.append(this.allMessages);

      this.panel.append(this.messageBox);
      if (message.start !== true){
        this.add(message);
      }

      this.link = $("<li>");
      this.link.append($("<a>", {
        href: "#".concat(this.id),
        "aria-controls": "tab",
        role: "tab",
        "data-toggle": "tab",
        "data-to": message.from,
        text: message.from,
        class: "chat-tab-link",
        id: this.id.concat("-tab")
      }));
    }

    ChatPanel.prototype.tab = function () {
      console.log("#".concat(this.id));
      $("#".concat(this.id).concat("-tab")).tab("show");
    };

    ChatPanel.prototype.active = function () {
      $("#".concat(this.id).concat("-tab")).tab("show");
    };

    ChatPanel.prototype.getElement = function () {
      return this.panel;
    };

    ChatPanel.prototype.getLink = function () {
      return this.link;
    };

    ChatPanel.prototype.add = function (message) {

      var messageElement = $("<div>", {
        class: message.from === $.ongaku.getUser().username ? 'msg right' : 'msg'
      });
      messageElement.append($("<div>", {
        class: "from",
        text: message.from,
      }));

      messageElement.append($("<div>", {
        class: "value-message",
        text: message.message,
      }));

      messageElement.append($("<div>", {
        class: "date",
        text: message.date,
      }));

      this.allMessages.append(messageElement);
      this.messageBox.animate({ scrollTop: this.allMessages.innerHeight()}, 1000);
    };

    function ChatWidget(socket){
      var that = this;
      this.socket = socket;
      this.chats = [];

      this.chat = $("<li>", {
        class: "chat-container"
      });
      this.opener = $("<a>", {
        class: "chat-opener"
      });
      this.opener.append($("<i>", {
        class: "fa fa-comments-o"
      }));
      this.opener.append($("<span>", {
        text: "Chat"
      }));

      this.chat.append(this.opener);

      this.popup = $("<div>", {
        class: "message-box"
      });

      this.input = $("<input>", {
        class: "input-box form-control"
      });
      this.button = $("<a>", {
        class: 'chat-message-send-button'
      });
      this.button.text("send");

      this.button.on('click', function(){
        that.send();
      });

      this.input.on('keyup', function (e) {
        if (e.keyCode == 13) {
          that.send();
        }
      });

      this.chatsElements = $('<ul>', {
        class: "nav nav-tabs",
        role: "tablist"
      });
      this.tabContent = $('<div>', {
        class: "tab-content"
      });

      this.popup.append(this.chatsElements);
      this.popup.append(this.tabContent);
      this.popup.append(this.input);
      this.popup.append(this.button);
      this.chat.append(this.popup);

      this.bind();
    }

    ChatWidget.prototype.send = function() {
      var message = {
        from: $.ongaku.getUser().username,
        to: $(".message-box li.active a").data("to"),
        message: $(this.input).val(),
        date: new Date()
      };
      this.socket.emit("msg", message);
      this.incoming(message);

      $(this.input).val("");
    };

    ChatWidget.prototype.bind = function () {
      var that = this;
      $(this.opener).on('click', function(){
        that.toggle();
      });
    };

    ChatWidget.prototype.toggle = function () {
      this.popup.toggleClass("show");
    };

    ChatWidget.prototype.add = function (message) {
      var chatPanel = new ChatPanel(message);
      this.chats[message.from] = chatPanel;
      this.tabContent.append(chatPanel.getElement());
      this.chatsElements.append(chatPanel.getLink());
      chatPanel.tab();
      $(this.input).focus();
      return chatPanel;
    };

    ChatWidget.prototype.getChat = function (from) {
      return this.chats[from];
    };

    ChatWidget.prototype.incoming = function (message) {
      if (!this.popup.hasClass("show")){
        this.toggle();
      }
      var userChat;

      if (message.from === $.ongaku.getUser().username){
        userChat = this.getChat(message.to);
      } else {
        userChat = this.getChat(message.from);
      }
      if (userChat){
        userChat.add(message);
      } else {
        this.add(message);
      }
    };

    ChatWidget.prototype.getElement = function () {
      return this.chat;
    };

    function Chat(socket, user){
      var that = this;
      this.socket = socket;
      if (user){
        if (this.chat == null){
          this.chat = new ChatWidget(socket);
          $("#header .navbar-header nav ul").append(this.chat.getElement());
        }
        socket.emit('checkin', {user: user});

        socket.on('msg', function(incoming){
          that.chat.incoming(incoming);
        });

        socket.on("checkin", function(incoming){
          socket.emit('checkin', incoming);
        });

        socket.on("statuschange", function(incoming){
          $(incoming).each(function(index, userstatus){
            for (var username in userstatus) {
              var selector = "i.fa.fa-circle.status[data-user=" + username + "]";
              $(selector).removeClass("away");
              $(selector).removeClass("online");
              $(selector).removeClass("busy");
              $(selector).removeClass("offline");
              $(selector).addClass(userstatus[username]);
            }
          });
        });

        $(".user-status li a").on("click", function(){
          if ($(this).data("status")){
              socket.emit("statuschange", {
              user: $.ongaku.getUser().username,
              status: $(this).data("status")
            });
          }
        });
      }
      return this;
    }

    Chat.prototype.start = function (user) {
      if (!this.chat.getChat(user)){
        this.chat.add({
          from: user,
          to: $.ongaku.getUser().username,
          start: true
        });
      } else {
        this.chat.getChat(user).active();
      }

      if (!this.chat.popup.hasClass("show")){
        this.chat.toggle();
      }
    };
    /**
    * Initialise chat
    *
    */
    $.chat = {
      init: function(socket, user){
        if (!$.chat.el){
          $.chat.el = new Chat(socket, user);
        }
      },
      start: function(user){
        $.chat.el.start(user);
      }
    };

}(jQuery);
