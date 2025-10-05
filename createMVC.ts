const myArgs = process.argv.slice(2);
const { exec } = require('child_process');
exec(
  `nest generate controller logic/${myArgs[0]}  && nest generate service logic/${myArgs[0]} && nest generate module logic/${myArgs[0]}`,
  (err, stdout, stderr) => {
    if (err) {
      // node couldn't execute the command
      return;
    }

    // the *entire* stdout and stderr (buffered)
    console.log(`stdout: ${stdout}`);
    console.log(`stderr: ${stderr}`);
  },
);

