+function ($) {
    'use strict';

    function ChatPanel(message){
      this.panel = $("<div>", {
        class: "chat-panel tab-pane",
        id: message.from
      });

      this.messageBox = $("<div>", {
        class: "message-inbox"
      });

      this.allMessages = $("<div>");
      this.messageBox.append(this.allMessages);

      this.panel.append(this.messageBox);
      if (message.start){
        this.add(message);
      }

      this.link = $("<li>");
      this.link.append($("<a>", {
        href: "#".concat(message.from),
        "aria-controls": "tab",
        role: "tab",
        "data-toggle": "tab",
        "data-to": message.from,
        text: message.from
      }));
    };

    ChatPanel.prototype.getElement = function () {
      return this.panel;
    };

    ChatPanel.prototype.getLink = function () {
      return this.link;
    };

    ChatPanel.prototype.add = function (message) {

      var messageElement = $("<div>", {
        class: message.from === $.ongaku.getUser() ? 'msg right' : 'msg'
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
      }))
      this.opener.append($("<span>", {
        text: "Chat"
      }));

      this.chat.append(this.opener);

      this.popup = $("<div>", {
        class: "message-box"
      });

      this.input = $("<input>", {
        class: "input-box form-control"
      }).change(function () {
        var message = {
          from: $.ongaku.getUser(),
          to: $(".message-box li.active a").data("to"),
          message: $(this).val(),
          date: new Date()
        };
        socket.emit("msg", message);
        //that.incoming(message);

        $(this).val("");
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
      this.chat.append(this.popup);

      this.bind();
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
      $(chatPanel).tab();
      return chatPanel;
    };

    ChatWidget.prototype.getChat = function (from) {
      return this.chats[from];
    }

    ChatWidget.prototype.incoming = function (message) {
      if (!this.popup.hasClass("show")){
        this.toggle();
      }
      var userChat;

      if (message.from === $.ongaku.getUser()){
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

        this.chat = new ChatWidget(socket);
        $("#header .navbar-header nav ul").append(this.chat.getElement());

        socket.emit('checkin', {user: user});

        socket.on('msg', function(incoming){
          that.chat.incoming(incoming);
        });
      }
      return this;
    };

    Chat.prototype.start = function (user) {
      this.chat.add({
        from: user,
        to: $.ongaku.getUser(),
        start: true
      });
    };
    /**
    * Initialise chat
    *
    */
    $.chat = {
      init: function(socket, user){
        $.chat.el = new Chat(socket, user);
      },
      start: function(user){
        $.chat.el.start(user);
      }
    };

}(jQuery);
