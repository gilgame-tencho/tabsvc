const fs = require('fs');
const path = require('path');
const fl = require('node-filelist');
const {exec} = require('child_process');
const { program } = require("commander");

// const PWD = process.env.PWD;
const ws_name = 'ws';
const svc_name = 'svc';
// tmp tableau_dev_tool/.
const option = {"ext": "tfl"};

const WS = path.join(__dirname, ws_name);
const ROOT = path.basename(__dirname);
const SVC = path.join(__dirname, svc_name);

function what_params(){    
    console.log(WS);
    console.log(ROOT);
    console.log(option);
}

function path_parse(path){
    var res = {};
    res.path = path;
    res.order = path.split('\\');
    res.root_index = res.order.findIndex(element => element === ROOT) + 2;
    res.ws_order = res.order.concat().slice(res.root_index, res.order.length - 1);

    var tmp_order = res.order.concat();
    tmp_order.splice(res.root_index - 1, 1, svc_name);
    res.svc_path = tmp_order.join('\\');

    res.name = res.order[res.order.length -1];
    res.base_name = res.name.replace('.'+option.ext, '');
    res.root = res.order[0];
    return res;
}

function main_init(){
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
            exec('unzip -o ' + item.path + ' -d ' + item.svc_path, (err, stdout, stderr) => {
                if (err) { throw err }
                console.log(`stdout: ${stdout}`);
            });
        }
    });
}

function main_decompose(){
    console.log('comming soon. decompose!!');
}

function main_commit(){
    console.log('comming soon. commit!!');
}

function main_deploy(){
    console.log('comming soon. deploy!!');
}

program
  .name('tableau src vertion control')
  .version('0.0.1', '-v, --version, version')
  .option("-h, --help, help", "Show help.")

program.command('init')
  .description('git repo init.')
  .action((str, options)=> {
    main_init();
});

program.command('decompose')
  .description('ws prep files to svc file decompose.')
  .alias('d')
  .action((str, options)=> {
    main_decompose();
});

program.command('commit')
  .description('git commit.')
  .alias('c')
  .action((str, options)=> {
    main_commit();
});

program.command('deploy')
  .description('samthing enviroment prep deployment. at deploy.conf')
  .argument('[env]', 'deploy enviroment.')
  .alias('d')
  .action((str, options)=> {
    main_deploy();
});

program.command('dev')
  .description('show dev parameters')
  .action((str, options)=> {
    what_params();
});

program.parse();

//   .command("init", "git repo init.")
//   .command("decompose", "ws prep files to svc file decompose.")
//   .command("commit", "git commit.")
//   .command("deploy [env]", "samthing enviroment prep deployment. at deploy.conf", (value) => { return (value || []).split(","); }, [])


if (process.argv.length < 3) {
  program.help();
}
