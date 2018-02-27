[![Build Status](https://travis-ci.org/svandecappelle/ongaku.svg?branch=master)](https://travis-ci.org/svandecappelle/ongaku) [![bitHound Overall Score](https://www.bithound.io/github/svandecappelle/ongaku/badges/score.svg)](https://www.bithound.io/github/svandecappelle/ongaku) [![bitHound Dependencies](https://www.bithound.io/github/svandecappelle/ongaku/badges/dependencies.svg)](https://www.bithound.io/github/svandecappelle/ongaku/master/dependencies/npm) [![bitHound Dev Dependencies](https://www.bithound.io/github/svandecappelle/ongaku/badges/devDependencies.svg)](https://www.bithound.io/github/svandecappelle/ongaku/master/dependencies/npm) [![bitHound Code](https://www.bithound.io/github/svandecappelle/ongaku/badges/code.svg)](https://www.bithound.io/github/svandecappelle/ongaku) [![Coverage Status](https://coveralls.io/repos/github/svandecappelle/ongaku/badge.svg?branch=master)](https://coveralls.io/github/svandecappelle/ongaku?branch=master)

ongaku
======

Music &amp; video browser player in nodejs.
Demo [Here](http://music.mizore.fr/ "here")

# Getting started
## Installation
* Install node
* Clone the project
* Install project dependencies
  * Install ffmpeg
    * Ubuntu / Debian
    ``` sudo apt install ffmpeg ```
    * Fedora / CentOs
    ``` sudo dnf install ffmpeg ```
    * Archlinux / Manjaro
    ``` sudo pacman -S ffmpeg```
  * Install node canvas dependencies
    * Ubuntu / Debian
    ``` sudo apt-get install libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev build-essential g++ ```
    * Fedora / CentOs
    ``` sudo yum install cairo cairo-devel cairomm-devel libjpeg-turbo-devel pango pango-devel pangomm pangomm-devel giflib-devel ```
    * Archlinux / Manjaro
    ``` sudo pacman -S  cairo cairomm libjpeg-turbo pango pangomm giflib ```
  * Run: ```npm install```
* Configure your library dir and redis database in ```config.yml``` file
* Start ```npm start```
* Go to your browser at: ```hostname:4000/``` and create an admin user using the web installer. (consider configuring nginx as reverse proxy to serve :80 or :443 ports on www)

Screenshots:
![Screenshot1](http://imagik.fr/images/2016/10/25/Capturedecrande2016-10-2517-39-07.png)
![Screenshot2](http://imagik.fr/images/2016/10/25/Capturedecrande2016-10-2517-39-25.png)
![Screenshot3](http://imagik.fr/images/2016/10/25/Capturedecrande2016-10-2517-39-54.png)
![Screenshot4](http://imagik.fr/images/2016/10/25/Capturedecrande2016-10-2517-41-15.png)
