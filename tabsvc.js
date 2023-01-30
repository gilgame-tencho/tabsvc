const fs = require('fs');
const path = require('path');
const fl = require('node-filelist');
// const unzip = require('unzip');
const {exec} = require('child_process')

// const PWD = process.env.PWD;
const ws_name = 'ws';
const svc_name = 'svc';
// tmp tableau_dev_tool/.
const option = {"ext": "tfl"};

const WS = path.join(__dirname, ws_name);
const ROOT = path.basename(__dirname);
const SVC = path.join(__dirname, svc_name);

console.log(WS);
console.log(ROOT);

function path_parse(path){
    var res = {};
    res.path = path;
    res.order = path.split('\\');
    res.root_index = res.order.findIndex(element => element === ROOT) + 2;
    res.ws_order = res.order.concat().slice(res.root_index, res.order.length - 1);
    // res.svc_path = res.order.concat();
    var tmp_order = res.order.concat();
    tmp_order.splice(res.root_index - 1, 1, svc_name);
    res.svc_path = tmp_order.join('\\');
    res.name = res.order[res.order.length -1];
    res.base_name = res.name.replace('.'+option.ext, '');
    res.root = res.order[0];
    return res;
}

fl.read([WS], option, function(rs){
    for(var i=0; i<rs.length; i++){
        var file = rs[i];
        // console.log(file);
        var item = path_parse(file.path);
        console.log(item);

        var wdir = svc_name;
        for(var j=0; j<item.ws_order.length; j++){
            wdir = path.join(wdir, item.ws_order[j]);
            if (!fs.existsSync(wdir)) {
                fs.mkdirSync(wdir);
            }
        }
        wdir = path.join(wdir, item.name);
        if (!fs.existsSync(wdir)) {
            fs.mkdirSync(wdir);
        }
        // fs.createReadStream(item.path).pipe( unzip.Extract( { path: wdir } ) );
        // exec('cd ' + wdir);
        exec('unzip ' + item.path + ' -d ' + item.svc_path, (err, stdout, stderr) => {
            if (err) { throw err }
            console.log(`stdout: ${stdout}`);
        });
        // exec('pwd', (err, stdout, stderr) => {
        //     if (err) { throw err }
        //     console.log(`stdout: ${stdout}`);
        // });


        // exec('cd ' + wdir, (error, stdout, stderr) => {
        //     if (err) { throw err }
        // });
        // exec('pwd', (error, stdout, stderr) => {
        //     if (err) { throw err }
        //     console.log(`stdout: ${stdout}`);
        //     // console.error(`stderr: ${stderr}`);
        // });
    }
});
