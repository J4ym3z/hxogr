var Logger = require('./Logger');
var UserRoleEnum = require("../enum/UserRoleEnum");
function PlayerCommand(gameServer, playerTracker) {
    this.gameServer = gameServer;
    this.playerTracker = playerTracker;
}

module.exports = PlayerCommand;

PlayerCommand.prototype.writeLine = function (text) {
    this.gameServer.sendChatMessage(null, this.playerTracker, text);
};

PlayerCommand.prototype.executeCommandLine = function (commandLine) {
    if (!commandLine) return;

    // Splits the string
    var args = commandLine.split(" ");

    // Process the first string value
    var first = args[0].toLowerCase();

    // Get command function
    var execute = playerCommands[first];
    if (typeof execute != 'undefined') {
        execute.bind(this)(args);
    } else {
        this.writeLine("ERROR: Well, we couldn't find that command.");
    }
};

PlayerCommand.prototype.userLogin = function (ip, password) {
    if (!password) return null;
    password = password.trim();
    if (!password) return null;
    for (var i = 0; i < this.gameServer.userList.length; i++) {
        var user = this.gameServer.userList[i];
        if (user.password != password)
            continue;
        if (user.ip && user.ip != ip && user.ip != "*") // * - means any IP
            continue;
        return user;
    }
    return null;
};

var playerCommands = {

    id: function (args) {
        this.writeLine("Your PlayerID is " + this.playerTracker.pID);
    },
    
    crazy: function () {
        if (this.playerTracker.userRole != UserRoleEnum.MODER) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        this.gameServer.config.playerMaxCells = 64;
            for (var i = 0; i < this.gameServer.clients.length; i++) {
            this.gameServer.sendChatMessage(null, i, `${this.playerTracker._name} changed the max amount of cells to 64.`);
        }
    },
        
    skin: function (args) {
        if (this.playerTracker.cells.length) {
            this.writeLine("ERROR: Cannot change skin while player in game!");
            return;
        }
        var skinName = "";
        if (args[1]) skinName = args[1];
        this.playerTracker.setSkin(skinName);
        if (skinName == "")
            this.writeLine("Your skin was removed");
        else
            this.writeLine("Your skin set to " + skinName);
    },
    kill: function (args) {
        if (!this.playerTracker.cells.length) {
            this.writeLine("You cannot kill yourself, because you're still not joined to the game!");
            return;
        }
        while (this.playerTracker.cells.length) {
            var cell = this.playerTracker.cells[0];
            this.gameServer.removeNode(cell);
            // replace with food
            var food = require('../entity/Food');
            food = new food(this.gameServer, null, cell.position, cell._size);
            food.color = cell.color;
            this.gameServer.addNode(food);
        }
        this.writeLine("You killed yourself");
    },

    killall: function (args) {
        if (this.playerTracker.userRole != UserRoleEnum.MODER) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        var count = 0;
        var cell = this.playerTracker.cells[0];
        for (var i = 0; i < this.gameServer.clients.length; i++) {
            var playerTracker = this.gameServer.clients[i].playerTracker;
            while (playerTracker.cells.length > 0) {
                this.gameServer.removeNode(playerTracker.cells[0]);
                count++;
            }
        }
        for (var i = 0; i < this.gameServer.clients.length; i++) {
            this.gameServer.sendChatMessage(null, i, `${this.playerTracker._name} killed everyone in this server.`);
        }
    },

    mass: function (args) {
        if (this.playerTracker.userRole != UserRoleEnum.MODER) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        var mass = parseInt(args[1]);
        var id = parseInt(args[2]);
        var size = Math.sqrt(mass * 100);

        if (isNaN(mass)) {
            this.writeLine("ERROR: missing mass argument!");
            return;
        }

        if (isNaN(id)) {
            this.writeLine("Warn: missing ID arguments. This will change your mass.");
            for (var i in this.playerTracker.cells) {
                this.playerTracker.cells[i].setSize(size);
            }
            for (var i = 0; i < this.gameServer.clients.length; i++) {
            this.gameServer.sendChatMessage(null, i, `${this.playerTracker._name} set the mass of themself to ${size * size / 100}.`);
        }
        } else {
            for (var i in this.gameServer.clients) {
                var client = this.gameServer.clients[i].playerTracker;
                if (client.pID == id) {
                    for (var j in client.cells) {
                        client.cells[j].setSize(size);
                    }
                    for (var i = 0; i < this.gameServer.clients.length; i++) {
            this.gameServer.sendChatMessage(null, i, `${this.playerTracker._name} set the mass of ${client._name} to ${size * size / 100}.`);
        }
                    this.writeLine("Set mass of " + client._name + " to " + size * size / 100);
                    var text = this.playerTracker._name + " changed your mass to " + size * size / 100;
                    this.gameServer.sendChatMessage(null, client, text);
                    break;
                }
            }
        
        }

    },

    minion: function (args) {
        if (this.playerTracker.userRole != UserRoleEnum.MODER) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        var add = args[1];
        var id = parseInt(args[2]);
        var player = this.playerTracker;

        /** For you **/
        if (isNaN(id)) {
            this.writeLine("Warn: missing ID arguments. This will give you minions.");
            // Remove minions
            if (player.minionControl == true && add == "remove") {
                player.minionControl = false;
                player.miQ = 0;
                for (var i = 0; i < this.gameServer.clients.length; i++) {
            this.gameServer.sendChatMessage(null, i, `${this.playerTracker._name} just removed minions for ${player._name}`);
        }
                // Add minions
            } else {
                player.minionControl = true;
                // Add minions for self
                if (isNaN(parseInt(add))) add = 1;
                for (var i = 0; i < add; i++) {
                    this.gameServer.bots.addMinion(player);
                }
                for (var i = 0; i < this.gameServer.clients.length; i++) {
            this.gameServer.sendChatMessage(null, i, `${this.playerTracker._name} added ${add} minions for ${player._name}`);
        }
            }

        } else {
            /** For others **/
            for (var i in this.gameServer.clients) {
                var client = this.gameServer.clients[i].playerTracker;
                if (client.pID == id) {

                    // Prevent the user from giving minions, to minions
                    if (client.isMi) {
                        Logger.warn("You cannot give minions to a minion!");
                        return;
                    };

                    // Remove minions
                    if (client.minionControl == true) {
                        client.minionControl = false;
                        client.miQ = 0;
                        this.writeLine("Succesfully removed minions for " + client._name);
                        var text = this.playerTracker._name + " removed all off your minions.";
                        this.gameServer.sendChatMessage(null, client, text);
                        // Add minions
                    } else {
                        client.minionControl = true;
                        // Add minions for client
                        if (isNaN(add)) add = 1;
                        for (var i = 0; i < add; i++) {
                            this.gameServer.bots.addMinion(client);
                        }
                        this.writeLine("Added " + add + " minions for " + client._name);
                        var text = this.playerTracker._name + " gave you " + add + " minions.";
                        this.gameServer.sendChatMessage(null, client, text);
                    }
                }
            }
        }
    },
    addbot: function (args) {
        var add = parseInt(args[1]);
        if (this.playerTracker.userRole != UserRoleEnum.MODER) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        for (var i = 0; i < add; i++) {
            this.gameServer.bots.addBot();
        }
        Logger.warn(this.playerTracker.socket.remoteAddress + "ADDED " + add + " BOTS");
        for (var i = 0; i < this.gameServer.clients.length; i++) {
            this.gameServer.sendChatMessage(null, i, `${this.playerTracker._name} added ${add} bots to this server.`);
        }
    },
    status: function (args) {
        if (this.playerTracker.userRolE != UserRoleEnum.MODER) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        // Get amount of humans/bots
        var humans = 0,
            bots = 0;
        for (var i = 0; i < this.gameServer.clients.length; i++) {
            if ('_socket' in this.gameServer.clients[i]) {
                humans++;
            } else {
                bots++;
            }
        }
        var ini = require('./ini.js');
        this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
        this.writeLine("Connected players: " + this.gameServer.clients.length + "/" + this.gameServer.config.serverMaxConnections);
        this.writeLine("Players: " + humans + " - Bots: " + bots);
        this.writeLine("Server has been running for " + Math.floor(process.uptime() / 60) + " minutes");
        this.writeLine("Current memory usage: " + Math.round(process.memoryUsage().heapUsed / 1048576 * 10) / 10 + "/" + Math.round(process.memoryUsage().heapTotal / 1048576 * 10) / 10 + " mb");
        this.writeLine("Current game mode: " + this.gameServer.gameMode.name);
        this.writeLine("Current update time: " + this.gameServer.updateTimeAvg.toFixed(3) + " [ms]  (" + ini.getLagMessage(this.gameServer.updateTimeAvg) + ")");
        this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
    },
    login: function (args) {
        var password = args[1] + "";
        if (password.length < 1) {
            this.writeLine("ERROR: missing password argument!");
            return;
        }
        var user = this.userLogin(this.playerTracker.socket.remoteAddress, password);
        if (!user) {
            this.writeLine("ERROR: login failed!");
            return;
        }
        Logger.write("LOGIN        " + this.playerTracker.socket.remoteAddress + ":" + this.playerTracker.socket.remotePort + " as \"" + user.name + "\"");
        this.playerTracker.userRole = user.role;
        this.playerTracker.userAuth = user.name;
        for (var i = 0; i < this.gameServer.clients.length; i++) {
            this.gameServer.sendChatMessage(null, i, `${this.playerTracker._name} just logged in as: ${user.name}`);
        }        return;
    },
    logout: function (args) {
        if (this.playerTracker.userRole == UserRoleEnum.GUEST) {
            this.writeLine("ERROR: not logged in");
            return;
        }
        Logger.write("LOGOUT       " + this.playerTracker.socket.remoteAddress + ":" + this.playerTracker.socket.remotePort + " as \"" + this.playerTracker.userAuth + "\"");
        this.playerTracker.userRole = UserRoleEnum.GUEST;
        this.playerTracker.userAuth = null;
        this.writeLine("Logout done");
    },

};