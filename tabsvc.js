const fs = require('fs');
const path = require('path');
const fl = require('node-filelist');

// const PWD = process.env.PWD;
const ws_name = 'ws';
// tmp tableau_dev_tool/.

const WS = path.join(__dirname, ws_name);
const ROOT = path.basename(__dirname);

console.log(WS);
console.log(ROOT);

function path_parse(path){
    var res = {};
    res.path = path;
    res.order = path.split('\\');
    res.ws_order = res.order.slice(res.order.findIndex(element => element === ROOT) + 2, res.order.length - 1);
    res.name = res.order[res.order.length -1];
    res.root = res.order[0];
    return res;
}

var option = {"ext": "tfl"};
return fl.read([WS], option, function(rs){
    for(var i=0; i<rs.length; i++){
        var file = rs[i];
        // console.log(file);
        var item = path_parse(file.path);
        // console.log(item);


    }
});
