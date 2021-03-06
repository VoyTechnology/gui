var path = require("path");
var fs = require("fs");

function getUserHome() {
  return process.env.HOME || process.env.USERPROFILE;
}

function getFilesystems() {
  var fileSystemsDir = path.join(getUserHome(), ".pfs", "filesystems");
  var fileNames = fs.readdirSync(fileSystemsDir);
  var filesystems = [];
  for (var i=0; i<fileNames.length; i++) {
    var fsPath = path.join(fileSystemsDir, fileNames[i]);
    var filesystem = {
      name: fileNames[i],
      path: fsPath,
      mounted: fileSystemIsMounted(fileNames[i]),
      attributes: loadJsonFile(path.join(fsPath, "meta", "attributes")),
      pool: readFile(path.join(fsPath, "meta", "pool")),
      uuid: readFile(path.join(fsPath, "meta", "uuid"))
    };
    filesystems.push(filesystem);
  }

  return filesystems;
}

function drawFileSystem(i) {
  var fileSystem = fileSystems[i];

  var str = readFile("html/filesystem.html");
  var html = $.parseHTML(str);
  $(".content").html(html);

  // Heading
  $(".content #fsName").html(fileSystem.name);
  $(".content #fsMountSection").hide();

  // status section
  if (fileSystem.mounted) {
    $(".content #fsStatus #fsMountedLabel").html('<b>mounted<b>');
    $(".content #fsStatus #fsMountedLabel").addClass("label label-success");
    $(".content #mountUnmountButton").html("Unmount");
    $(".content #mountUnmountButton").attr("class", "btn btn-warning");
    $(".content #mountUnmountButton").attr("onClick", "mountUnmountButtonClicked(" + i + ")");
    $(".content #autoMountButton").hide();
    $(".content .onlyForMountedSection").show();
    $(".content #refreshButton").show();

    getFilesystemStatus(fileSystem.name, function(s) {
      $(".content #fsStatus #mountpoint").html(getFilesystemMountpoint(fileSystem.path));
      $(".content #fsStatus #clistatus").html(s);
    });
    getFilesystemNodes(fileSystem.name, function(s) {
      $(".content #fsStatus #nodes").html(s);
    });

  } else {
    $(".content #fsStatus #fsMountedLabel").html('<b>not mounted<b>');
    $(".content #fsStatus #fsMountedLabel").addClass("label label-warning");
    $(".content #mountUnmountButton").html("Mount");
    $(".content #mountUnmountButton").attr("class", "btn btn-success");
    $(".content #mountUnmountButton").attr("onClick", "mountUnmountButtonClicked(" + i + ")");
    $(".content #autoMountButton").show();
    $(".content .onlyForMountedSection").hide();
    $(".content #refreshButton").hide();
  }

  // mount section
  $(".content #fsMountSection #fsMountForm").submit(mountFS);

  // attributes section
  if (!fileSystem.attributes.encrypted) {
    $(".content #fsAttributes #fsAttributeEncrypted #badge").html('<b>NO<b>');
    $(".content #fsAttributes #fsAttributeEncrypted #badge").addClass("label label-danger");
  }

  if (fileSystem.attributes.networkoff) {
    $(".content #fsAttributes #fsAttributeNetwork #badge").html('<b>NO<b>');
    $(".content #fsAttributes #fsAttributeNetwork #badge").addClass("label label-danger");
  }

  if (!fileSystem.attributes.keygenerated) {
    $(".content #fsAttributes #fsAttributeKeygen #badge").html('<b>NO<b>');
    $(".content #fsAttributes #fsAttributeKeygen #badge").addClass("label label-danger");
  }

  $(".content #fsAttributes #fsAttributePool #badge").html('<b>' + fileSystem.pool + '<b>');
  $(".content #fsAttributes #fsAttributeUuid #badge").html('<b>' + fileSystem.uuid + '<b>');

  // delete section
  $(".content #fsDeleteSection #deleteButton").attr("onClick", 'deleteClicked($(".content #fsDeleteSection #nameCheckText").val(), ' + i + ');');
}

function newfs(form) {
  var exec = require('child_process').exec;
  var cmd = "paranoid-cli init ";
  if (!form.secure.checked) {
    cmd += "-u ";
  }
  if (!form.network.checked) {
    cmd += "--networkoff ";
  }
  if (!form.encrypted.checked) {
    cmd += "--unencrypted ";
  }
  if (form.cert.value !== "") {
    cmd += "--cert " + form.cert.value + " ";
  }
  if (form.key.value !== "") {
    cmd += "--key " + form.key.value + " ";
  }
  if (form.pool.value !== "") {
    cmd += "--pool " + form.pool.value + " ";
  }
  cmd += form.name.value;

  var input = "";
  if (form.numDays.value !== null) {
    input += form.numDays.value.toString() + "\n";
  } else {
    input += "100\n";
  }

  if (form.organisation.value !== null) {
    input += form.organisation.value;
  }
  input += "\n";

  if (form.hostnames.value !== null) {
    input += form.hostnames.value;
  }
  input += "\n";

  var child = exec(cmd, function(error, stdout, stderr) {
    if (error !== null) {
      alert(error);
      return;
    }

    if (stderr !== "") {
      alert(stderr);
    }

    fileSystems = getFilesystems();
    loadSideBar();
    rowClicked(-1);
  });
  child.stdin.write(input);
}

function deleteClicked(val, i) {
  var fileSystem = fileSystems[i];
  if (val != fileSystem.name) {
    alert("Incorrect FileSystem name");
  } else {
    deleteFs(i);
  }
}

function deleteFs(i) {
  var exec = require('child_process').exec;
  var cmd = "paranoid-cli delete " + fileSystems[i].name;
  exec(cmd, function(error, stdout, stderr) {
    var e = false;
    if (error !== null) {
      alert(error);
      e = true;
    }
    if (stdout !== "") {
      alert(stdout);
      e = true;
    }
    if (e) {
      return;
    }

    fileSystems = getFilesystems();
    loadSideBar();
    rowClicked(-1);
  });
}

function pathExists(filePath) {
  var fs = require("fs");
  try {
    fs.accessSync(filePath, fs.F_OK);
    return true;
  } catch(e) {
    return false;
  }
}

function readFile(filePath) {
  var fs = require("fs");
  return fs.readFileSync(filePath, "utf8");
}

function loadJsonFile(filePath) {
  return JSON.parse(readFile(filePath));
}

function fileSystemIsMounted(fsName) {
  var pidFile = path.join(getUserHome(), ".pfs", "filesystems", fsName, "meta", "pfsd.pid");

  if (!pathExists(pidFile)) {
    return false;
  } else {
    var pid = readFile(pidFile);
    var execSync = require('child_process').execSync;
    var cmd = "ps " + pid;
    try {
      var code = execSync(cmd);
      return true;
    } catch (e) {
      alert(e);
      return false;
    }
  }
}

function mountUnmountButtonClicked(i){
  var fileSystem = fileSystems[i];
  if (fileSystem.mounted) {
    unMountFs(i);
  } else {
    if (!$(".content #fsMountSection").is(":visible")) {
      $(".content #fsMountSection").slideDown(200);
    } else {
      $(".content #fsMountSection").slideUp(200);
    }
  }
}

function automountButtonClicked() {
  var fileSystem = fileSystems[selected];

  var exec = require('child_process').exec;
  var cmd = "paranoid-cli automount -n " + fileSystem.name;

  exec(cmd, function(error, stdout, stderr) {
    var e = false;
    if (error !== null) {
      alert(error);
      e = true;
    }

    if (stdout !== "") {
      alert(stdout);
      e = true;
    }

    if (e) {
      return;
    }

    fileSystems = getFilesystems();
    loadSideBar();
    rowClicked(selected);
  });
}

function unMountFs(i) {
  var execSync = require('child_process').execSync;
  var cmd = "paranoid-cli unmount " + fileSystems[i].name;
  try {
    var code = execSync(cmd);
    fileSystems[i].mounted = false;
    loadSideBar();
    rowClicked(i);
  } catch (e) {
    alert(e);
    return false;
  }
}

function mountFS() {
  var exec = require('child_process').exec;
  var cmd = "paranoid-cli mount -n ";

  if($("#fsMountSection #fsMountForm #interface").val() !== "") {
    cmd += "-i " + $("#fsMountSection #fsMountForm #interface").val() + " ";
  }

  if($("#fsMountSection #fsMountForm #discovery").val() !== "") {
    cmd += "-d " + $("#fsMountSection #fsMountForm #discovery").val() + " ";
  }

  if($("#fsMountSection #fsMountForm #password").val() !== "") {
    cmd += "--pool-password " + $("#fsMountSection #fsMountForm #password").val() + " ";
  }

  cmd += fileSystems[selected].name + " " + $("#fsMountSection #fsMountForm #location").val();

  exec(cmd, function(error, stdout, stderr) {
    var e = false;
    if (error !== null) {
      alert(error);
      e = true;
    }

    if (stdout !== "") {
      alert(stdout);
      e = true;
    }

    if (e) {
      return;
    }

    fileSystems = getFilesystems();
    loadSideBar();
    rowClicked(selected);
  });
}

function getFilesystemStatus(fsName, callback) {
  var exec = require("child_process").exec;
  var cmd = "paranoid-cli status " + fsName;

  exec(cmd, function(error, stdout, stderr) {
    if (error !== null) {
      alert(error);
      return;
    }

    callback(stdout.replace("/n", "<br>"));
  });
}

function getFilesystemNodes(fsName, callback) {
  var exec = require("child_process").exec;
  var cmd = "paranoid-cli list-nodes " + fsName;

  exec(cmd, function(error, stdout, stderr) {
    if (error !== null) {
      alert(error);
      return;
    }

    callback(stdout.replace("/n", "<br>"));
  });
}

function getFilesystemMountpoint(fsPath) {
  var mpPath = path.join(fsPath, "meta", "mountpoint");
  return readFile(mpPath);
}

function refreshButtonClicked() {
  drawFileSystem(selected);
}

function openButtonPressed() {
  var path = getFilesystemMountpoint(fileSystems[selected].path);
  var gui = require("nw.gui");
  gui.Shell.showItemInFolder(path + "/.");
}
