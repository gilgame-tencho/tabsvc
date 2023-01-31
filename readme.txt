Tableau Dev Tool
Tableau Devlopment tool.

---
Sorce version control for Tableau Prep Builer. & Deploy
---


---
Usage
---
Tableau Prep Builder work.
from local machene prep file and data.
please use folder path is [ws].

work done at ws. after root path change dir.
kick command [save ws]

and, make up deploy src. command is [compile]

compile configuration file is deploy.conf

example:
  $ cd .
  $ tabsvc commit
  $ tabsvc deploy


---
Install and Setup.
---
* nodejs install
* git for windows install ( use git bash. )

$ git clone xxxxx
$ npm i


---
Start up.
---

$ tabsvc init
-- git repo init
   only initial fhease.

$ tabsvc decompose
  tabsvc d
-- ws prep files to svc file decompose.

$ tabsvc commit
-- git commit

$ tabsvc deploy
--  samthing enviroment prep deployment. at deploy.conf.
