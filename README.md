#HomeGrown Marine: Signal, race analysis and replay

With race data stored as JSON, will graph metrics, associate them with the track, and do some tack performance analysis.

![](https://raw.githubusercontent.com/HomegrownMarine/signal/master/README/overview.png)
![](https://raw.githubusercontent.com/HomegrownMarine/signal/master/README/tack_details.png)
![](https://raw.githubusercontent.com/HomegrownMarine/signal/master/README/tack_list.png)

See the latest live here: (http://gradymorgan.com/signal/race.html?2015_worlds_8)

##Installation:

- This assumes that data has been processed by [Homegrown Marine/process/](https://github.com/HomegrownMarine/process)

- install [bower](http://bower.io)
- run ```bower install```
- run ```npm install```
- run ```grunt build```
- run ```node run.js```
- goto http://localhost:8080 or http://localhost:8080/tacks.html


##TODO
- fft wind
	- shift detector
- check tack numbers
- underlays better graphics
