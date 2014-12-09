#!/bin/bash
START_TIME=${2:-0}
VARIABLE_BIT_RATE=${3:-4}
ABSOLUTE_PATH=$1

if [ -z $ABSOLUTE_PATH ];
then
    echo "{ \"ERROR\" : \"Not given an absolute path to the media file\" }" 
else
    ffmpeg -ss $START_TIME -i $ABSOLUTE_PATH -f wav - | lame --vbr-new -V $VARIABLE_BIT_RATE - -
fi