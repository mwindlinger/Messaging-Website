//#!/usr/bin/env node
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs"),
	crypto = require('crypto');
var mysql = require("mysql");
var mysqli = mysql.createConnection({
		host: "localhost",
		user: "cwmod",
		password: "wustlcwmodwustl",
		database: "module6data"
	});
var userlist = [];
var roomuserlist = [{rn:"Main Lobby", ul:[]}];		//[{rn:"roomname", ul:["user"]}]

//init////////////////////////////////////
connectDB();

var app = http.createServer(function(req, resp){
	fs.readFile("chatClient.html", function(err, data){
		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(3456);


//!!!all data from back: escape after parse


var io = socketio.listen(app);
io.sockets.on("connection", function(socket){
	
	socket.on('TSvr_login', function(data) {
		var t_username = castToString(data.username);
		var t_password = castToString(data.password);
		var whatString = 'SELECT * FROM userdata WHERE username=';
		var toWhom = "tHail_" + t_username;
                var shed = crypto.pbkdf2Sync(t_password, md5(t_password), 10000, 512, 'sha512').toString('hex');               //100000 is just too slow we dont need to be that paranoid
		t_username = mysql_real_escape_string(t_username);
		whatString += "'"+t_username+"'";
		mysqli.query(whatString,function(err,result){
			if(err){
				console.log('Error connecting to Db');
				console.log(err);
				io.sockets.emit(toWhom, {loginOK: 0, type: 1 });
				return false;
			}
			
			if (result.length > 0) {
				if ( shed === result[0].password ) {
					io.sockets.emit(toWhom, {loginOK: 1, type: 1 });
					broadcastUpdate();
					userlist.push(t_username);
				}
				else {
					io.sockets.emit(toWhom, {loginOK: 0, type: 1 });
				}
			}
			else {
				io.sockets.emit(toWhom, {loginOK: 0, type: 1 });
			}
		});
	});
	
	socket.on('TSvr_signup', function(data) {
		var t_username = castToString(data.username);
		var t_password = castToString(data.password);
		var toWhom = "tHail_" + t_username;
		var whatString = 'SELECT * FROM userdata WHERE username=';
                var shed = crypto.pbkdf2Sync(t_password, md5(t_password), 10000, 512, 'sha512').toString('hex');
		whatString += "'"+t_username+"'";
		//t_password += 'TBrFZQ+qwVdm8o$]6y4rXqdyru}LeO$*cFqJ+';		//this file will not be served, right? yeah, i hope so.
		t_username = mysql_real_escape_string(t_username);
		t_password = mysql_real_escape_string(shed);            //sure lets use those fancy node js stuff
		var insertWhat = {username: mysql_real_escape_string(t_username), password: mysql_real_escape_string(t_password)};
		mysqli.query(whatString,function(err,result){
			if(err){
				console.log('Error connecting to Db');
				console.log(err);
				io.sockets.emit(toWhom, {signupOK: 0, type: 2 });
			  return false;
			}
			
			if (result.length > 0) {
				io.sockets.emit(toWhom, {signupOK: 0, type: 2 });
			}
			else {
				mysqli.query('INSERT INTO userdata SET ?', insertWhat, function(err2, result2) {
					if(err2){
						console.log('Error connecting to Db');
						console.log(err2);
						io.sockets.emit(toWhom, {signupOK: 0, type: 2 });
					  return false;
					}
					else {
						io.sockets.emit(toWhom, {signupOK: 1, type: 2 });
						broadcastUpdate();
						userlist.push(t_username);
					}
				});
			}
		});
	});
	
	socket.on('TSvr_signout', function(data) {                      //need ice cream... go buy ice cream try(teddrews) monday
		var username = castToString(data.username);
		var prevroom = castToString(data.prevRm);
                var forceWhomOut = null;
		
		for (var i = 0; i < userlist.length; i++) {
			if(userlist[i] === username){
				userlist.splice(i,1);
			}
		}
		removeUserFromRoom(username, prevroom);
		
                if (prevroom !== "Main Lobby") {                 //i almost forget this
                        for (i = 0; i < roomuserlist.length; i++) {
                                if (roomuserlist[i].rn===prevroom){
                                        for (var j = 0; j < roomuserlist[i].ul.length; j++) {
                                                forceWhomOut = "Hail_" + roomuserlist[i].ul[j];
                                                io.sockets.emit(forceWhomOut,{
                                                        currRoom: "Main Lobby",
                                                        isKicked: 0,            //!!!when iskicked = 0 display a message to explain why room dismissed
                                                        type: 8
                                                });
                                        }
                                }
                        }
                        
                        prevroom = mysql_real_escape_string(prevroom);
                        whatString = "DELETE FROM roomdata WHERE room='"+prevroom+"'";          //when room dismissed all msg associated with that room also cascade, bad new for censorship
                        
                        mysqli.query(whatString, function(err, result) {
                                if(err){
                                        console.log('Error connecting to Db');
                                        console.log(err);
                                        return false;
                                }
                                
                        });							
                        removeRoomFromList(prevroom);
			broadcastUpdate();
                }
		else {
			broadcastUpdate();
			multicastRoomUpdate(prevroom);
		}
		
		
	});
	//!!!need to create main lobby manually in db
	socket.on('TSvr_uinit', function(data) {
		var username = castToString(data.username);
                
                var chkUserExist_chk = mysql_real_escape_string(castToString(username));
                var chkUserExist_whatString = "SELECT * FROM userdata WHERE username='"+chkUserExist_chk+"'";
                mysqli.query(chkUserExist_whatString,function(err,result){
                        if (result.length > 0) {
                                var roomlist = [];
                                var permlist = [];
                                var historyMsg = [];
                                var whatMsg = {};
                                whatMsg.de = "";
                                whatMsg.msg = "";
                                whatMsg.datetime = "";
                                var whatString = 'SELECT * FROM roomdata';
                                var toWhom = "Hail_" + username;
                                mysqli.query(whatString,function(err,result){
                                        if(err){
                                                console.log('Error connecting to Db');
                                                console.log(err);
                                                return false;
                                        
                                        }
                                        for (var i = 0; i < result.length; i++) {
                                                roomlist.push(result[i].room);
                                                permlist.push(result[i].ispublic);
                                        }
                                        mysqli.query("SELECT * FROM msgdata WHERE room='Main Lobby' AND privatemsg=0 ORDER BY id DESC LIMIT 50", function(err,result) {
                                                if(err){
                                                        console.log('Error connecting to Db');
                                                        console.log(err);
                                                        return false;
                                                
                                                }
                                                if(result.length>0){
                                                        for (var i = 0; i < result.length; i++) {
                                                                whatMsg = {};
                                                                whatMsg.de = result[i].de;
                                                                whatMsg.msg = result[i].msg;
                                                                whatMsg.datetime = result[i].datetime;
                                                                historyMsg.push(whatMsg);
                                                                addUserToRoom(username, "Main Lobby");
                                                        }
                                                }
                                                else {
                                                        historyMsg = [];
                                                }
                                                io.sockets.emit(toWhom, {roomLi: roomlist, permLi: permlist, userLi: userlist, currRoom: "Main Lobby", hisMsg: historyMsg, type: 3 });
                                                multicastRoomUpdate("Main Lobby");
                                        });
                                });
		        }
                });
	});
	
	socket.on('TSvr_createRm', function(data) {
		var username = castToString(data.username);
		var roomname = castToString(data.roomname);
		var isPublic = Number(data.isPublic);
		var roomPwd = castToString(data.roomPwd);
		var tokenGen = "";
		var insertWhat = {};
		var toWhom = "Hail_" + username;
		var roommaster = "";
                
                var chkUserExist_chk = mysql_real_escape_string(castToString(username));
                var chkUserExist_whatString = "SELECT * FROM userdata WHERE username='"+chkUserExist_chk+"'";
                mysqli.query(chkUserExist_whatString,function(err,result){
                        if (result.length > 0) {
                                if (roomname) {
                                        var chkRoomExist_chk = mysql_real_escape_string(castToString(roomname));
                                        var chkRoomExist_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomExist_chk+"'";
                                        mysqli.query(chkRoomExist_whatString,function(err,result){
                                                if (result.length === 0) {
                                                        if (isPublic === 0) {
                                                                if (roomPwd) {
                                                                        roomname = mysql_real_escape_string(roomname);
                                                                        roommaster = mysql_real_escape_string(username);
                                                                        roomPwd = mysql_real_escape_string(roomPwd);
                                                                        tokenGen = mysql_real_escape_string(crypto.randomBytes(64).toString('hex'));
                                                                        insertWhat = {room: roomname, master: roommaster, token: tokenGen, ispublic:0, roompwd: roomPwd};
                                                                        mysqli.query('INSERT INTO roomdata SET ?', insertWhat, function(err, result) {
                                                                                if(err){
                                                                                        console.log('Error connecting to Db');
                                                                                        console.log(err);
                                                                                        io.sockets.emit(toWhom, {
                                                                                                currRoom: null,
                                                                                                roomMaster: null,
                                                                                                createOK: 0,
                                                                                                roomToken: null,
                                                                                                errmsg: err,
                                                                                                type: 4
                                                                                        });
                                                                                        return false;
                                                                                }
                                                                                else {
                                                                                        addNewRoomToList(roomname);
											addUserToRoom(username, roomname);
                                                                                        io.sockets.emit(toWhom, {
                                                                                                currRoom: roomname,
                                                                                                roomMaster: roommaster,
                                                                                                createOK: 1,
                                                                                                roomToken: tokenGen,
                                                                                                errmsg: null,
                                                                                                type: 4
                                                                                        });
                                                                                        multicastRoomUpdate(roomname);
                                                                                        broadcastUpdate();
                                                                                        multicastRoomUpdate(roomname);
                                                                                }
                                                                        });
                                                                }
                                                                else {
                                                                        io.sockets.emit(toWhom, {
                                                                                                currRoom: null,
                                                                                                roomMaster: null,
                                                                                                createOK: 0,
                                                                                                roomToken: null,
                                                                                                errmsg: "Private room password cannot be empty",
                                                                                                type: 4
                                                                        });
                                                                        return false;
                                                                }
                                                        }
                                                        else if (isPublic === 1) {
                                                                roomname = mysql_real_escape_string(roomname);
                                                                roommaster = mysql_real_escape_string(username);
                                                                tokenGen = mysql_real_escape_string(crypto.randomBytes(64).toString('hex'));
                                                                insertWhat = {
                                                                        room: roomname,
                                                                        master: roommaster,
                                                                        token: tokenGen,
                                                                        ispublic:1,
                                                                        roompwd: null
                                                                };
                                                                mysqli.query('INSERT INTO roomdata SET ?', insertWhat, function(err, result) {
                                                                        if(err){
                                                                                console.log('Error connecting to Db');
                                                                                console.log(err);
                                                                                io.sockets.emit(toWhom, {
                                                                                        currRoom: null,
                                                                                        roomMaster: null,
                                                                                        createOK: 0,
                                                                                        roomToken: null,
                                                                                        errmsg: err,
                                                                                        type: 4
                                                                                });
                                                                                return false;
                                                                        }
                                                                        else {
                                                                                addNewRoomToList(roomname);
										addUserToRoom(username, roomname);
                                                                                io.sockets.emit(toWhom, {
                                                                                        currRoom: roomname,
                                                                                        roomMaster: roommaster,
                                                                                        createOK: 1,
                                                                                        roomToken: tokenGen,
                                                                                        errmsg: null,
                                                                                        type: 4
                                                                                });
                                                                                multicastRoomUpdate(roomname);
                                                                                broadcastUpdate();
                                                                                multicastRoomUpdate(roomname);
                                                                        }
                                                                });
                                                        }
                                                        else {
                                                                io.sockets.emit(toWhom, {
                                                                                                currRoom: null,
                                                                                                roomMaster: null,
                                                                                                createOK: 0,
                                                                                                roomToken: null,
                                                                                                errmsg: "Corrupted request",
                                                                                                type: 4
                                                                        });
                                                        }
                                                }
                                                else {
                                                        io.sockets.emit(toWhom, {
                                                                                currRoom: null,
                                                                                roomMaster: null,
                                                                                createOK: 0,
                                                                                roomToken: null,
                                                                                errmsg: "Room Exist",
                                                                                type: 4
                                                        });
                                                }
                                        });
                                }
                                else {
                                        io.sockets.emit(toWhom, {
                                                                currRoom: null,
                                                                roomMaster: null,
                                                                createOK: 0,
                                                                roomToken: null,
                                                                errmsg: "Room name cannot be empty",
                                                                type: 4
                                        });
                                }
                        }
                        else {
                                io.sockets.emit(toWhom, {
                                                                currRoom: null,
                                                                roomMaster: null,
                                                                createOK: 0,
                                                                roomToken: null,
                                                                errmsg: "User does not exist",
                                                                type: 4
                                        });
                        }
                });
	});
	
	socket.on('TSvr_tryRm', function(data) {
		var username = castToString(data.username);
		var roomname = castToString(data.rmName);
		var roomPwd = castToString(data.rmPwd);
		var prevroom = castToString(data.prevRm);
		var denied = 1;
		var gotorm = null;
		var roomtoken = null;
		var whatmsg = "Access denied";
		var toWhom = "Hail_" + username;
                var forceWhomOut = null;
                
                var chkUserExist_chk = mysql_real_escape_string(castToString(username));
                var chkUserExist_whatString = "SELECT * FROM userdata WHERE username='"+chkUserExist_chk+"'";
                mysqli.query(chkUserExist_whatString,function(err,result){
                        if (typeof result) {
                                var chkRoomExist_chk = mysql_real_escape_string(castToString(roomname));
                                var chkRoomExist_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomExist_chk+"'";
                                mysqli.query(chkRoomExist_whatString,function(err,result){
                                        if (typeof result) {
                                                var chkUserIsBannedFromRoom_chkroom = mysql_real_escape_string(castToString(roomname));
                                                var chkUserIsBannedFromRoom_chkuser = mysql_real_escape_string(castToString(username));
                                                var chkUserIsBannedFromRoom_whatString = "SELECT * FROM bandata WHERE room='"+chkUserIsBannedFromRoom_chkroom+"' AND ban='"+chkUserIsBannedFromRoom_chkuser+"'";
                                                mysqli.query(chkUserIsBannedFromRoom_whatString,function(err,result){
                                                        if (!result.length) {
                                                                var roomPwdFlag = false;
                                                                var chkRoomPwd_chkroom = mysql_real_escape_string(castToString(roomname));
                                                                var chkRoomPwd_chkpwd = mysql_real_escape_string(castToString(roomPwd));		//for symmetry
                                                                var chkRoomPwd_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomPwd_chkroom+"'";
								
								
                                                                mysqli.query(chkRoomPwd_whatString,function(err,result){
                                                                        if (result.length > 0) {
										console.log(chkRoomPwd_chkroom);
                                                                                if(result[0].ispublic === 1) {
                                                                                    roomPwdFlag = true;
                                                                                }
                                                                                else if(result[0].roompwd === roomPwd) {
											roomPwdFlag = true;
										}
                                                                        }
                                                                        //else {
                                                                        //        roomPwdFlag=false;
                                                                        //}
                                                                        if (roomPwdFlag) {
                                                                                
                                                                                var getRoomToken_chkroom = mysql_real_escape_string(castToString(roomname));
                                                                                var getRoomToken_whatString = "SELECT * FROM roomdata WHERE room='"+getRoomToken_chkroom+"'";
                                                                                mysqli.query(getRoomToken_whatString,function(err,result){
                                                                                        if (typeof result) {
                                                                                                roomtoken = castToString(result[0].token);
                                                                                                denied = 0;
                                                                                                gotorm = roomname;
                                                                                                whatmsg = null;
                                                                                                removeUserFromRoom(username, prevroom);
                                                                                                if (prevroom !== roomname) {
                                                                                                        var getRoomMaster_chkroom = mysql_real_escape_string(castToString(prevroom));
                                                                                                        var getRoomMaster_whatString = "SELECT * FROM roomdata WHERE room='"+getRoomMaster_chkroom+"'";
                                                                                                        mysqli.query(getRoomMaster_whatString,function(err,result){
                                                                                                                if (result.length > 0) {
                                                                                                                        if( username === castToString(result[0].master)) {
                                                                                                                                for (var i = 0; i < roomuserlist.length; i++) {
                                                                                                                                        if (roomuserlist[i].rn===prevroom){
                                                                                                                                                for (var j = 0; j < roomuserlist[i].ul.length; j++) {
                                                                                                                                                        forceWhomOut = "Hail_" + roomuserlist[i].ul[j];
                                                                                                                                                        io.sockets.emit(forceWhomOut,{
                                                                                                                                                                currRoom: "Main Lobby",
                                                                                                                                                                isKicked: 0,            //!!!when iskicked = 0 display a message to explain why room dismissed
                                                                                                                                                                type: 8
                                                                                                                                                        });
                                                                                                                                                }
                                                                                                                                        }
                                                                                                                                }
                                                                                                                                
                                                                                                                                prevroom = mysql_real_escape_string(prevroom);
                                                                                                                                whatString = "DELETE FROM roomdata WHERE room='"+prevroom+"'";
                                                                                                                        
                                                                                                                                mysqli.query(whatString, function(err, result) {
                                                                                                                                        if(err){
                                                                                                                                                console.log('Error connecting to Db');
                                                                                                                                                console.log(err);
                                                                                                                                                return false;
                                                                                                                                        }
                                                                                                                                        
                                                                                                                                });							
                                                                                                                                removeRoomFromList(prevroom);
																broadcastUpdate();
																multicastRoomUpdate(roomname);
                                                                                                                        }
                                                                                                                }
                                                                                                        });
                                                                                                }
                                                                                                io.sockets.emit(toWhom, {
                                                                                                        isdenied: denied,
                                                                                                        currRoom: gotorm,
                                                                                                        roomToken: roomtoken,
                                                                                                        errmsg: whatmsg,
                                                                                                        type: 5
                                                                                                });
												broadcastUpdate();
												multicastRoomUpdate(prevroom);
												multicastRoomUpdate(roomname);
                                                                                        }
                                                                                        else {
                                                                                                roomtoken = null;
                                                                                                denied = 1;
                                                                                                gotorm = null;
                                                                                                whatmsg = "Token failure";
                                                                                                io.sockets.emit(toWhom, {
                                                                                                        isdenied: denied,
                                                                                                        currRoom: gotorm,
                                                                                                        roomToken: roomtoken,
                                                                                                        errmsg: whatmsg,
                                                                                                        type: 5
                                                                                                });
                                                                                        }
                                                                                });
                                                                        }
                                                                        else {
                                                                                roomtoken = null;
                                                                                denied = 1;
                                                                                gotorm = null;
                                                                                whatmsg = "Room and Password does not match our record";
                                                                                io.sockets.emit(toWhom, {
                                                                                        isdenied: denied,
                                                                                        currRoom: gotorm,
                                                                                        roomToken: roomtoken,
                                                                                        errmsg: whatmsg,
                                                                                        type: 5
                                                                                });
                                                                        }
                                                                
                                                                });
                                                        }
                                                        else {
                                                                roomtoken = null;
                                                                denied = 1;
                                                                gotorm = null;
                                                                whatmsg = "You are banned from this room";
                                                                io.sockets.emit(toWhom, {
                                                                        isdenied: denied,
                                                                        currRoom: gotorm,
                                                                        roomToken: roomtoken,
                                                                        errmsg: whatmsg,
                                                                        type: 5
                                                                });
                                                        }
                                                });
                                        }
                                        else {
                                                roomtoken = null;
                                                denied = 1;
                                                gotorm = null;
                                                whatmsg = "Room and Password does not match our record";
                                                io.sockets.emit(toWhom, {
                                                        isdenied: denied,
                                                        currRoom: gotorm,
                                                        roomToken: roomtoken,
                                                        errmsg: whatmsg,
                                                        type: 5
                                                });
                                        }
                                });
                        }
                        else {
                                roomtoken = null;
                                denied = 1;
                                gotorm = null;
                                whatmsg = "User does not exist";
                                io.sockets.emit(toWhom, {
                                        isdenied: denied,
                                        currRoom: gotorm,
                                        roomToken: roomtoken,
                                        errmsg: whatmsg,
                                        type: 5
                                });
                        }
                });
	});
	
	socket.on('TSvr_rinit', function(data) {
		var username = castToString(data.username);
		var roomname = castToString(data.roomname);
		var roomtoken = castToString(data.roomtoken);
		var toWhom = "Hail_" + username;
		var gotorm = null;
		var whatmaster = null;
		var whatHistoryMsg = [];
		
                var chkUserExist_chk = mysql_real_escape_string(castToString(username));
                var chkUserExist_whatString = "SELECT * FROM userdata WHERE username='"+chkUserExist_chk+"'";
                mysqli.query(chkUserExist_whatString,function(err,result){
                        if (typeof result) {
                                //return true;
                                var chkRoomExist_chk = mysql_real_escape_string(castToString(roomname));
                                var chkRoomExist_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomExist_chk+"'";
                                mysqli.query(chkRoomExist_whatString,function(err,result){
                                        if (typeof result) {
                                                
                                                var chkRoomToken_chkroom = mysql_real_escape_string(castToString(roomname));
                                                var chkRoomToken_chktoken = mysql_real_escape_string(castToString(roomtoken));		//for symmetry
                                                var chkRoomToken_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomToken_chkroom+"'";
                                                mysqli.query(chkRoomToken_whatString,function(err,result){
                                                        if (typeof result) {
                                                                if (typeof result) {
                                                                        gotorm = roomname;
                                                                        var getRoomMaster_chkroom = mysql_real_escape_string(castToString(roomname));
                                                                        var getRoomMaster_whatString = "SELECT * FROM roomdata WHERE room='"+getRoomMaster_chkroom+"'";
                                                                        mysqli.query(getRoomMaster_whatString,function(err,result){
                                                                                if (typeof result) {
                                                                                        whatmaster = castToString(result[0].master);
                                                                                        
                                                                                        
                                                                                        var getHisMsg_historyMsg = [];
                                                                                        var getHisMsg_whatroom = mysql_real_escape_string(roomname);
                                                                                        var getHisMsg_whatString = "SELECT * FROM msgdata WHERE room='"+getHisMsg_whatroom+"' AND privatemsg=0 ORDER BY id DESC LIMIT 50";
                                                                                        var getHisMsg_whatMsg = {};
                                                                                        getHisMsg_whatMsg.de = "";
                                                                                        getHisMsg_whatMsg.msg = "";
                                                                                        getHisMsg_whatMsg.datetime = "";
                                                                                        
                                                                                        mysqli.query(getHisMsg_whatString, function(err,result) {
                                                                                                if(err){
                                                                                                    console.log('Error connecting to Db');
                                                                                                    console.log(err);
                                                                                                    return null;
                                                                                                }
                                                                                                if(result.length>0){
                                                                                                        for (var i = 0; i < result.length; i++) {
                                                                                                                getHisMsg_whatMsg = {};
                                                                                                            getHisMsg_whatMsg.de = result[i].de;
                                                                                                            getHisMsg_whatMsg.msg = result[i].msg;
                                                                                                            getHisMsg_whatMsg.datetime = result[i].datetime;
                                                                                                            getHisMsg_historyMsg.push(getHisMsg_whatMsg);
                                                                                                        }
                                                                                                        getHisMsg_historyMsg = getHisMsg_historyMsg.reverse();		//so actually this native func is the slowest method, interesting... meh i dont care
                                                                                                }
                                                                                                
                                                                                                whatHistoryMsg = getHisMsg_historyMsg;
                                                                                                addUserToRoom(username, roomname);
                                                                                                multicastRoomUpdate(roomname);
                                                                                                
                                                                                                io.sockets.emit(toWhom, {
                                                                                                        currRoom: gotorm,
                                                                                                        roomMaster: whatmaster,
                                                                                                        hisMsg: whatHistoryMsg,
                                                                                                        type: 6
                                                                                                });
                                                                                                
                                                                                                multicastRoomUpdate(roomname);
                                                                                                
                                                                                        });
                                                                                }
                                                                        });
                                                                }
                                                                else {
                                                                        gotorm = null;
                                                                        whatmaster = null;
                                                                        whatHistoryMsg = [];
                                                                        
                                                                        io.sockets.emit(toWhom, {
                                                                                currRoom: gotorm,
                                                                                roomMaster: whatmaster,
                                                                                hisMsg: whatHistoryMsg,
                                                                                type: 6
                                                                        });
                                                                }
                                                        }        
                                                });
                                        }
                                        else {
                                                gotorm = null;
                                                whatmaster = null;
                                                whatHistoryMsg = [];
                                                io.sockets.emit(toWhom, {
                                                        currRoom: gotorm,
                                                        roomMaster: whatmaster,
                                                        hisMsg: whatHistoryMsg,
                                                        type: 6
                                                });
                                        }
                                });
                        }
                        else {
                                gotorm = null;
                                whatmaster = null;
                                whatHistoryMsg = [];
                                
                                io.sockets.emit(toWhom, {
                                currRoom: gotorm,
                                roomMaster: whatmaster,
                                hisMsg: whatHistoryMsg,
                                type: 6
                        });
                        }
                        
                });
		
	});
	
	socket.on('TSvr_speak', function(data) {
		var date = new Date();
		var username = castToString(data.username);
		var t_roomname = castToString(data.roomname);
		var roomtoken = castToString(data.roomtoken);
		var t_message = castToString(data.msg);
		var isprivate = Number(data.isprivate);
		var t_datetime = date.toLocaleTimeString("en-us", {weekday: "long", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"});
		var t_target = castToString(data.to);
		var toWhom = "Hail_" + t_target;
		var toWhere = "TR_" + t_roomname;
		
		if (isprivate!==1) {isprivate = 0;}
		
                var chkUserExist_chk = mysql_real_escape_string(castToString(username));
                var chkUserExist_whatString = "SELECT * FROM userdata WHERE username='"+chkUserExist_chk+"'";
                mysqli.query(chkUserExist_whatString,function(err,result){
                        if (typeof result) {
                                var chkRoomExist_chk = mysql_real_escape_string(castToString(t_roomname));
                                var chkRoomExist_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomExist_chk+"'";
                                mysqli.query(chkRoomExist_whatString,function(err,result){
                                        if (typeof result) {
                                                var chkRoomToken_chkroom = mysql_real_escape_string(castToString(t_roomname));
                                                var chkRoomToken_chktoken = mysql_real_escape_string(castToString(roomtoken));		//for symmetry
                                                var chkRoomToken_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomToken_chkroom+"'";
                                                mysqli.query(chkRoomToken_whatString,function(err,result){
                                                        if (typeof result) {
                                                                if (typeof result) {
                                                                        
                                                                        var insertWhat = {
                                                                                room: mysql_real_escape_string(t_roomname),
                                                                                de: mysql_real_escape_string(username),
                                                                                datetime: mysql_real_escape_string(t_datetime),
                                                                                msg: mysql_real_escape_string(t_message),
                                                                                privatemsg: mysql_real_escape_string(isprivate),
                                                                                towhom: mysql_real_escape_string(t_target)
                                                                        };
                                                                        
                                                                        if (isprivate===0) {
                                                                                io.sockets.emit(toWhere,{
                                                                                        roomname: t_roomname,
                                                                                        de: username,
                                                                                        msg: t_message,
                                                                                        datetime: t_datetime,
                                                                                        type: 2
                                                                                });
                                                                                
                                                                        }
                                                                        else if (isprivate===1) {
                                                                                io.sockets.emit(toWhom,{
                                                                                        roomname: t_roomname,
                                                                                        de: username,
                                                                                        msg: t_message,
                                                                                        datetime: t_datetime,
                                                                                        type: 7
                                                                                });
                                                                        }
                                                                        
                                                                        mysqli.query('INSERT INTO msgdata SET ?', insertWhat, function(err, result) {
                                                                                if(err){
                                                                                        console.log('Error connecting to Db');
                                                                                        console.log(err);
                                                                                        return false;
                                                                                }
                                                                        });
                                                                }
                                                        }
                                                });
                                        }
                                });
                        }
                });
	});
	
	socket.on('TSvr_kick', function(data) {
		var username = castToString(data.username);
		var roomname = castToString(data.roomname);
		var roomtoken = castToString(data.roomtoken);
		var kickwho = castToString(data.kickWho);
		var toWhom = "Hail_" + kickwho;
		
                var chkUserExist_chk = mysql_real_escape_string(castToString(username));
                var chkUserExist_whatString = "SELECT * FROM userdata WHERE username='"+chkUserExist_chk+"'";
                mysqli.query(chkUserExist_whatString,function(err,result){
                        if (typeof result) {
                        //return true;
                        
                                var chkRoomExist_chk = mysql_real_escape_string(castToString(roomname));
                                var chkRoomExist_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomExist_chk+"'";
                                mysqli.query(chkRoomExist_whatString,function(err,result){
                                        if (typeof result) {
                                                var chkRoomToken_chkroom = mysql_real_escape_string(castToString(roomname));
                                                var chkRoomToken_chktoken = mysql_real_escape_string(castToString(roomtoken));		//for symmetry
                                                var chkRoomToken_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomToken_chkroom+"'";
                                                mysqli.query(chkRoomToken_whatString,function(err,result){
                                                        if (typeof result) {
                                                                if (typeof result) {
                                                                        //!!!
                                                                        var getRoomMaster_chkroom = mysql_real_escape_string(castToString(roomname));
                                                                        var getRoomMaster_whatString = "SELECT * FROM roomdata WHERE room='"+getRoomMaster_chkroom+"'";
                                                                        mysqli.query(getRoomMaster_whatString,function(err,result){
                                                                                if (result.length > 0) {
                                                                                        if (username===castToString(result[0].master)) {
                                                                                                removeUserFromRoom(kickwho, roomname);
                                                                                                io.sockets.emit(toWhom,{
                                                                                                        currRoom: "Main Lobby",
                                                                                                        isKicked: 1,
                                                                                                        type: 8
                                                                                                });
                                                                                        }
                                                                                }
                                                                        });
                                                                }
                                                        }
                                                });
                                        }
                                });
                        }
                });
		
	});
	
	socket.on('TSvr_invite', function(data) {
		var username = castToString(data.username);
		var roomname = castToString(data.roomname);
		var roomtoken = castToString(data.roomtoken);
		var msg = castToString(data.msg);
		var invitee = castToString(data.invitee);
		var toWhom = "Hail_" + invitee;
		
                var chkUserExist_chk = mysql_real_escape_string(castToString(username));
                var chkUserExist_whatString = "SELECT * FROM userdata WHERE username='"+chkUserExist_chk+"'";
                mysqli.query(chkUserExist_whatString,function(err,result){
                        if (typeof result) {
                                //return true;
                                
                                var chkRoomExist_chk = mysql_real_escape_string(castToString(roomname));
                                var chkRoomExist_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomExist_chk+"'";
                                mysqli.query(chkRoomExist_whatString,function(err,result){
                                        if (typeof result) {
                                                var chkRoomToken_chkroom = mysql_real_escape_string(castToString(roomname));
                                                var chkRoomToken_chktoken = mysql_real_escape_string(castToString(roomtoken));		//for symmetry
                                                var chkRoomToken_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomToken_chkroom+"'";
                                                mysqli.query(chkRoomToken_whatString,function(err,result){
                                                        if (typeof result) {
								var getRoomMaster_chkroom = roomname;
								var getRoomMaster_whatString = "SELECT * FROM roomdata WHERE room='"+getRoomMaster_chkroom+"'";
								mysqli.query(getRoomMaster_whatString,function(err,result){
									if (result.length > 0) {
										if (username===castToString(result[0].master)) {
											io.sockets.emit(toWhom,{
												roomname: roomname,
												inviter: username,
												msg: msg,
												type: 9
											});
										}
									}
								});
                                                                
                                                        }
                                                });
                                        }
                                });
                        }
                });
		
	});
	
	socket.on('TSvr_ban', function(data) {		//allow master to ban users that are not in the room
		var username = castToString(data.username);
		var roomname = castToString(data.roomname);
		var roomtoken = castToString(data.roomtoken);
		var banWho = castToString(data.banWho);
		var toWhom = "Hail_" + banWho;
		
                var chkUserExist_chk = mysql_real_escape_string(castToString(username));
                var chkUserExist_whatString = "SELECT * FROM userdata WHERE username='"+chkUserExist_chk+"'";
                mysqli.query(chkUserExist_whatString,function(err,result){
                        if (typeof result) {
                            //return true;
                                var chkRoomExist_chk = mysql_real_escape_string(castToString(roomname));
                                var chkRoomExist_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomExist_chk+"'";
                                mysqli.query(chkRoomExist_whatString,function(err,result){
                                        if (typeof result) {
                                            //return true;
                                                
                                                var chkRoomToken_chkroom = mysql_real_escape_string(castToString(roomname));
                                                var chkRoomToken_chktoken = mysql_real_escape_string(castToString(roomtoken));		//for symmetry
                                                var chkRoomToken_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomToken_chkroom+"'";
                                                mysqli.query(chkRoomToken_whatString,function(err,result){
                                                        if (typeof result) {
                                                                        
								var getRoomMaster_chkroom = roomname;
								var getRoomMaster_whatString = "SELECT * FROM roomdata WHERE room='"+getRoomMaster_chkroom+"'";
								mysqli.query(getRoomMaster_whatString,function(err,result){
									if (result.length > 0) {
										if (username===castToString(result[0].master)) {       //!!!check if banuser exist
											var insertWhat = {
												ban: mysql_real_escape_string(banWho),
												room: mysql_real_escape_string(roomname),
											};
											
											removeUserFromRoom(banWho, roomname);		//this line will not do anything if user is not in that room
											mysqli.query('INSERT INTO bandata SET ?', insertWhat, function(err, result) {
												if(err){
													console.log('Error connecting to Db');
													console.log(err);
													return false;
												}
											});
											io.sockets.emit(toWhom,{
												roomname: roomname,			//!!!frontend CAUTION!!!
												currRoom: "Main Lobby",		//!!!will only move banned user to main lobby if hes in that room!!!
												isBanned: 1,
												type: 10
											});
										}
									}
								});
                                                                
                                                        }
                                                });
                                        }
                                });
                        }
                });
	});
	
	socket.on('TSvr_unban', function(data) {
		var username = castToString(data.username);
		var roomname = castToString(data.roomname);
		var roomtoken = castToString(data.roomtoken);
		var unbanWho = castToString(data.unbanWho);
		var msg = castToString(data.msg);
		var toWhom = "Hail_" + unbanWho;
		var whatString = "";
		
                var chkUserExist_chk = mysql_real_escape_string(castToString(username));
                var chkUserExist_whatString = "SELECT * FROM userdata WHERE username='"+chkUserExist_chk+"'";
                mysqli.query(chkUserExist_whatString,function(err,result){
                        if (typeof result) {
                                var chkRoomExist_chk = mysql_real_escape_string(castToString(roomname));
                                var chkRoomExist_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomExist_chk+"'";
                                mysqli.query(chkRoomExist_whatString,function(err,result){
                                        if (typeof result) {
                                                
                                                var chkRoomToken_chkroom = mysql_real_escape_string(castToString(roomname));
                                                var chkRoomToken_chktoken = mysql_real_escape_string(castToString(roomtoken));		//for symmetry
                                                var chkRoomToken_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomToken_chkroom+"'";
                                                mysqli.query(chkRoomToken_whatString,function(err,result){
                                                        if (typeof result) {
                                                                
                                                                        
								var getRoomMaster_chkroom = mysql_real_escape_string(castToString(roomname));
								var getRoomMaster_whatString = "SELECT * FROM roomdata WHERE room='"+getRoomMaster_chkroom+"'";
								mysqli.query(getRoomMaster_whatString,function(err,result){
									if (result.length > 0) {
										if (username===castToString(result[0].master)) {
											whatString = "DELETE FROM bandata WHERE ban='"+unbanWho+"' AND room='"+roomname+"'";
											
											mysqli.query(whatString, function(err, result) {
												if(err){
													console.log('Error connecting to Db');
													console.log(err);
													return false;
												}
												io.sockets.emit(toWhom,{
													roomname: roomname,
													isUnbanned: 1,
													msg: msg,
													type: 11
												});
											});
										}
									}
								});
                                                                
                                                        }
                                                });
                                        }
                                });
                        }
                });
	});

	socket.on('TSvr_history', function(data) {
		var username = castToString(data.username);
		var roomname = castToString(data.roomname);
		var roomtoken = castToString(data.roomtoken);
		var toWhom = "Hail_" + username;
		var startat = Number(data.startAt);
		var endat = startat+100;
		var hisMsg = [];
		//!!!frontend NEED to chk count the return and stop page from overturning
                
                var chkUserExist_chk = mysql_real_escape_string(castToString(username));
                var chkUserExist_whatString = "SELECT * FROM userdata WHERE username='"+chkUserExist_chk+"'";
                mysqli.query(chkUserExist_whatString,function(err,result){
                        if (result.length > 0) {
                            //return true;
                            
                                var chkRoomExist_chk = mysql_real_escape_string(castToString(roomname));
                                var chkRoomExist_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomExist_chk+"'";
                                mysqli.query(chkRoomExist_whatString,function(err,result){
                                        if (result.length > 0) {
                                                var chkRoomToken_chkroom = mysql_real_escape_string(castToString(roomname));
                                                var chkRoomToken_chktoken = mysql_real_escape_string(castToString(roomtoken));		//for symmetry
                                                var chkRoomToken_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomToken_chkroom+"'";
                                                mysqli.query(chkRoomToken_whatString,function(err,result){
                                                        if (result.length > 0) {
                                                                if (result[0].token === chkRoomToken_chktoken) {
                                                                        var getLotsOfHisMsg_historyMsg = [];
                                                                        var getLotsOfHisMsg_whatroom = mysql_real_escape_string(roomname);
                                                                        var getLotsOfHisMsg_sa = Number(startat);
                                                                        var getLotsOfHisMsg_ea = Number(endat);
                                                                        if (getLotsOfHisMsg_sa > getLotsOfHisMsg_ea) {
                                                                            getLotsOfHisMsg_sa += getLotsOfHisMsg_ea;
                                                                            getLotsOfHisMsg_ea = getLotsOfHisMsg_sa - getLotsOfHisMsg_ea;
                                                                            getLotsOfHisMsg_sa = getLotsOfHisMsg_sa - getLotsOfHisMsg_ea;
                                                                        }
                                                                        var getLotsOfHisMsg_whatString = "SELECT * FROM msgdata WHERE room='"+getLotsOfHisMsg_whatroom+"' AND privatemsg=0 ORDER BY id DESC LIMIT "+castToString(getLotsOfHisMsg_sa)+", "+castToString(getLotsOfHisMsg_ea);
                                                                        var getLotsOfHisMsg_whatMsg = {};
                                                                        getLotsOfHisMsg_whatMsg.de = "";
                                                                        getLotsOfHisMsg_whatMsg.msg = "";
                                                                        getLotsOfHisMsg_whatMsg.datetime = "";
                                                                        
                                                                        mysqli.query(getLotsOfHisMsg_whatString, function(err,result) {
                                                                            if(err){
                                                                                console.log('Error connecting to Db');
                                                                                console.log(err);
                                                                            }
                                                                            if(result.length>0){
                                                                                for (var i = 0; i < result.length; i++) {
                                                                                        getLotsOfHisMsg_whatMsg = {};
                                                                                        getLotsOfHisMsg_whatMsg.de = result[i].de;
                                                                                        getLotsOfHisMsg_whatMsg.msg = result[i].msg;
                                                                                        getLotsOfHisMsg_whatMsg.datetime = result[i].datetime;
                                                                                        getLotsOfHisMsg_historyMsg.push(getLotsOfHisMsg_whatMsg);
                                                                                }
                                                                                getLotsOfHisMsg_historyMsg = getLotsOfHisMsg_historyMsg.reverse();
                                                                            }
                                                                                hisMsg = getLotsOfHisMsg_historyMsg;
                                                                                endat = startat + hisMsg.length;
                                                                                io.sockets.emit(toWhom,{
                                                                                        roomname: roomname,
                                                                                        hisMsg: hisMsg,
                                                                                        startat: startat,
                                                                                        endat: endat,
                                                                                        type: 12
                                                                                });
                                                                        
                                                                        });
                                                                }
                                                        }
                                                });
                                        }
                                });
                        }
                });
	});
	
	socket.on('TSvr_hashtag', function(data) {
		var username = castToString(data.username);
		var roomname = castToString(data.roomname);
		var roomtoken = castToString(data.roomtoken);
		var toWhom = "Hail_" + username;
		var hashtag = "#"+castToString(data.hashtag)+"#%";
		var startat = Number(data.startAt);
		var endat = startat+100;
		var hashMsg = [];
		//!!!frontend NEED to chk count the return and stop overturning
                
                var chkUserExist_chk = mysql_real_escape_string(castToString(username));
                var chkUserExist_whatString = "SELECT * FROM userdata WHERE username='"+chkUserExist_chk+"'";
                mysqli.query(chkUserExist_whatString,function(err,result){
                        if (result.length > 0) {
                            //return true;
                                
                                var chkRoomExist_chk = mysql_real_escape_string(castToString(roomname));
                                var chkRoomExist_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomExist_chk+"'";
                                mysqli.query(chkRoomExist_whatString,function(err,result){
                                        if (result.length > 0) {
                                                
                                                var chkRoomToken_chkroom = mysql_real_escape_string(castToString(roomname));
                                                var chkRoomToken_chktoken = mysql_real_escape_string(castToString(roomtoken));		//for symmetry
                                                var chkRoomToken_whatString = "SELECT * FROM roomdata WHERE room='"+chkRoomToken_chkroom+"'";
                                                mysqli.query(chkRoomToken_whatString,function(err,result){
                                                        if (result.length > 0) {
                                                                if (result[0].token === chkRoomToken_chktoken) {
                                                                        
                                                                        var getMsgContaining_historyMsg = [];
                                                                        var getMsgContaining_whatroom = mysql_real_escape_string(roomname);
                                                                        var getMsgContaining_keyword = mysql_real_escape_string(hashtag);
                                                                        var getMsgContaining_sa = Number(startat);
                                                                        var getMsgContaining_ea = Number(endat);
                                                                        if (getMsgContaining_sa > getMsgContaining_ea) {
                                                                            getMsgContaining_sa += getMsgContaining_ea;
                                                                            getMsgContaining_ea = getMsgContaining_sa - getMsgContaining_ea;
                                                                            getMsgContaining_sa = getMsgContaining_sa - getMsgContaining_ea;
                                                                        }
                                                                        var getMsgContaining_whatString = "SELECT * FROM msgdata WHERE room='"+getMsgContaining_whatroom+"' AND privatemsg=0 AND msg LIKE '"+getMsgContaining_keyword+"' ORDER BY id DESC LIMIT "+castToString(getMsgContaining_sa)+", "+castToString(getMsgContaining_ea);
                                                                        var getMsgContaining_whatMsg = {};
                                                                        getMsgContaining_whatMsg.de = "";
                                                                        getMsgContaining_whatMsg.msg = "";
                                                                        getMsgContaining_whatMsg.datetime = "";
                                                                        
                                                                        mysqli.query(getMsgContaining_whatString, function(err,result) {
                                                                            if(err){
                                                                                console.log('Error connecting to Db');
                                                                                console.log(err);
                                                                                return [];
                                                                            }
                                                                            if(result.length>0){
                                                                                for (var i = 0; i < result.length; i++) {
                                                                                        getMsgContaining_whatMsg = {};
                                                                                    getMsgContaining_whatMsg.de = result[i].de;
                                                                                    getMsgContaining_whatMsg.msg = result[i].msg;
                                                                                    getMsgContaining_whatMsg.datetime = result[i].datetime;
                                                                                    getMsgContaining_historyMsg.push(getMsgContaining_whatMsg);
                                                                                }
                                                                                getMsgContaining_historyMsg = getMsgContaining_historyMsg.reverse();
                                                                            }
                                                                                hashMsg = getMsgContaining_historyMsg;
                                                                                endat = startat + hashMsg.length;
                                                                                io.sockets.emit(toWhom,{
                                                                                        roomname: roomname,
                                                                                        hashMsg: hashMsg,
                                                                                        startat: startat,
                                                                                        endat: endat,
                                                                                        type: 13
                                                                                });
                                                                        });
                                                                }        
                                                        }
                                                });
                                        }
                                });
                        }
                });
	});
	
	socket.on('TSvr_clipboard_get', function(data) {
		var username = castToString(data.username);
		var toWhom = "Hail_" + username;
                var password = castToString(data.password);
		var whatString = 'SELECT * FROM userdata WHERE username=';
                var whatOtherString = 'SELECT * FROM clipboard WHERE user=';
                var shed = crypto.pbkdf2Sync(password, md5(password), 10000, 512, 'sha512').toString('hex');
                var clipboardContainer = [];
                var clip = {};
                clip.msg = null;
                clip.datetime = null;
                clip.de = null;
                clip.id = null;
                
		//password += 'TBrFZQ+qwVdm8o$]6y4rXqdyru}LeO$*cFqJ+';	
		username = mysql_real_escape_string(username);
		whatString += "'"+username+"'";
                whatOtherString += "'"+username+"' ORDER BY id ASC";
		mysqli.query(whatString,function(err,result){
			if(err){
				console.log('Error connecting to Db');
				console.log(err);
				return false;
			}
			
			if (result.length > 0) {
				if ( shed === result[0].password ) {
					mysqli.query(whatOtherString,function(err,result){
                                                if(err){
                                                        console.log('Error connecting to Db');
                                                        console.log(err);
                                                        return false;
                                                }
                                                
                                                if(result.length>0){
                                                        for (var i = 0; i < result.length; i++) {
                                                                clip = {};
                                                                clip.id = result[i].id;
                                                                clip.de = result[i].de;
                                                                clip.msg = result[i].msg;
                                                                clip.datetime = result[i].datetime;
                                                                clipboardContainer.push(clip);
                                                                
                                                        }
                                                }
                                                else {
                                                        clipboardContainer = [];
                                                }
                                                
                                                io.sockets.emit(toWhom,{
                                                        clipMsg: clipboardContainer,
                                                        errmsg: null,
                                                        type: 14
						});
                                                
                                                
                                        });
				}
				else {
					io.sockets.emit(toWhom,{
                                                clipMsg: clipboardContainer,
                                                errmsg: "User record does not match.",
                                                type: 14
                                        });
				}
			}
			else {
				io.sockets.emit(toWhom,{
                                        clipMsg: clipboardContainer,
                                        errmsg: "User record does not match.",
                                        type: 14
                                });
			}
		});
        });
	
	socket.on('TSvr_clipboard_put', function(data) {
		var username = castToString(data.username);
		var toWhom = "Hail_" + username;
                var password = castToString(data.password);
		var whatString = 'SELECT * FROM userdata WHERE username=';
                var whatOtherString = 'INSERT INTO clipboard SET ?';
                var shed = crypto.pbkdf2Sync(password, md5(password), 10000, 512, 'sha512').toString('hex');
                var date = new Date();
                
                var clip = {};
                clip.msg = mysql_real_escape_string(castToString(data.msg));
                clip.datetime = mysql_real_escape_string(date.toLocaleTimeString("en-us", {weekday: "long", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"}));
                clip.de = mysql_real_escape_string(castToString(data.de));
                clip.user = mysql_real_escape_string(username);
                
		//password += 'TBrFZQ+qwVdm8o$]6y4rXqdyru}LeO$*cFqJ+';	
		username = mysql_real_escape_string(username);
		whatString += "'"+username+"'";
                
		mysqli.query(whatString,function(err,result){
			if(err){
				console.log('Error connecting to Db');
				console.log(err);
				return false;
			}
			if (result.length > 0) {
				if ( shed === result[0].password ) {
					mysqli.query(whatOtherString, clip, function(err,result){
                                                if(err){
                                                        console.log('Error connecting to Db');
                                                        console.log(err);
                                                        io.sockets.emit(toWhom,{
                                                                putOK: 0,
                                                                errmsg: err,
                                                                type: 15
                                                        });
                                                        return false;
                                                }
                                                
                                                io.sockets.emit(toWhom,{
                                                        putOK: 1,
                                                        errmsg: null,
                                                        type: 15
						});
                                                
                                                
                                        });
				}
				else {
					io.sockets.emit(toWhom,{
                                                putOK: 0,
                                                errmsg: "User record does not match.",
                                                type: 15
                                        });
				}
			}
			else {
				io.sockets.emit(toWhom,{
                                        putOK: 0,
                                        errmsg: "User record does not match.",
                                        type: 15
                                });
			}
		});
        });
	
	socket.on('TSvr_clipboard_rm', function(data) {
		var username = castToString(data.username);
                var password = castToString(data.password);
                var id = Number(data.id);
		var whatString = 'SELECT * FROM userdata WHERE username=';
                var whatOtherString = 'DELETE FROM clipboard WHERE id=';
                var shed = crypto.pbkdf2Sync(password, md5(password), 10000, 512, 'sha512').toString('hex');
		var toWhom = "Hail_" + username;
                
                //password += 'TBrFZQ+qwVdm8o$]6y4rXqdyru}LeO$*cFqJ+';	
		username = mysql_real_escape_string(username);
		whatString += "'"+username+"'";
                whatOtherString += "'"+id+"'";
                
		mysqli.query(whatString,function(err,result){
			if(err){
				console.log('Error connecting to Db');
				console.log(err);
				return false;
			}
                        if (result.length > 0) {
				if ( shed === result[0].password ) {
					mysqli.query(whatOtherString, function(err,result){
                                                if(err){
                                                        console.log('Error connecting to Db');
                                                        console.log(err);
                                                        io.sockets.emit(toWhom,{
                                                                delOK: 0,
                                                                errmsg: err,
                                                                type: 16
                                                        });
                                                        return false;
                                                }
                                                
                                                io.sockets.emit(toWhom,{
                                                        delOK: 1,
                                                        errmsg: null,
                                                        type: 16
						});
                                                
                                                
                                        });
				}
				else {
					io.sockets.emit(toWhom,{
                                                delOK: 0,
                                                errmsg: "User record does not match.",
                                                type: 16
                                        });
				}
			}
			else {
				io.sockets.emit(toWhom,{
                                        delOK: 0,
                                        errmsg: "User record does not match.",
                                        type: 16
                                });
			}
                });
                
                
                
                
        });

});             //on connection


function connectDB() {                  //should really write more curried function... goto house of india for dinner?
	mysqli.connect(function(err){
	if(err){
		console.log('Error connecting to Db');
		console.log(err);
	  return false;
	}
	return true;
	});
}

function broadcastUpdate() {            //ok
        var roomlist = [];             //oh yeah i forgot the io <i>is</i> a global var
        var permlist = [];
        
        mysqli.query("SELECT * FROM roomdata", function(err,result){
                if(err){
                        console.log('Error connecting to Db');
                        console.log(err);
                        
                        return false;
                }
                if(result.length>0){
                        for (var i = 0; i < result.length; i++) {
                                roomlist.push(result[i].room);
                                permlist.push(result[i].ispublic);
                        }
                }
                io.sockets.emit("TC_update",{                   //never ever move this outside callback
                        userLi: userlist,
                        roomLi: roomlist,
                        permLi: permlist
                });
        });
}

function multicastRoomUpdate(whatRoom) {
        var i=0;
        var j=0;
        for (i = 0; i < userlist.length ; i++) {
                for(j = 0; j < userlist.length ; j++){
                        if (userlist[i]===userlist[j] && i!==j) {
                                userlist.splice(j, 1);
                        }
                }
        }
        
        var whichRoom = castToString(whatRoom);
        var toWhichRoom = "TR_"+whichRoom;
        var rmUserLi = [];
        for (i = 0; i < roomuserlist.length ; i++) {
                if (roomuserlist[i].rn === whichRoom) {
                        rmUserLi = roomuserlist[i].ul;                  //i guess if i care abvt eta i can add break
                }
        }
        
	io.sockets.emit(toWhichRoom,{                   //never ever move this outside callback
                        rmUserLi: rmUserLi,
                        type: 1
                });
}

function addNewRoomToList(whatRoom) {
	var roomobj = {
		rn: whatRoom,
		ul: []
	};
	roomuserlist.push(roomobj);
	return;
}

function removeRoomFromList(whatRoom) {
	for (var i = 0; i < roomuserlist.length; i++) {
		if(roomuserlist[i].rn===whatRoom) {
			roomuserlist.splice(i,1);
			return;
		}
	}
	return;
}

function addUserToRoom(whatUser, whatRoom) {
	for (var i = 0; i < roomuserlist.length; i++) {
		if (roomuserlist[i].rn===whatRoom){
                        for(var j=0;j<roomuserlist[i].ul.length;j++) {
                                if (roomuserlist[i].ul[j] === whatUser) {
                                        roomuserlist[i].ul.splice(j,1);
                                }
                        }
			roomuserlist[i].ul.push(whatUser);
			return;
		}
	}
	return;
}

function removeUserFromRoom(whatUser, whatRoom) {
	for (var i = 0; i < roomuserlist.length; i++) {
		if (roomuserlist[i].rn===whatRoom){
			for (var j = 0; j < roomuserlist[i].ul.length; j++) {
				if(roomuserlist[i].ul[j]===whatUser) {
					roomuserlist[i].ul.splice(j,1);
					return;
				}
			}
		}
	}
	return;
}

//function chkUserExist(whatUser) {
//	var chkUserExist_chk = mysql_real_escape_string(String(whatUser));
//	var chkUserExist_whatString = "SELECT * FROM userdata WHERE username='"+chkUserExist_chk+"'";
//	mysqli.query(chkUserExist_whatString,function(err,result){
//		if (result.length > 0) {
//			return true;
//		}
//		else {
//			return false;
//		}
//	});
//}
////ah let them spoof usernames im so tired i dont care
//function genUserToken() {
//        return mysql_real_escape_string(crypto.randomBytes(64).toString('hex'));
//}
//
//function updateUserToken(whatUser, whatToken) {
//        //check if token exist
//        var updateUserToken_chkUserExist_chk = mysql_real_escape_string(String(username));
//        var updateUserToken_chkUserExist_whatString = "SELECT * FROM userdata WHERE username='"+updateUserToken_chkUserExist_chk+"'";
//        mysqli.query(updateUserToken_chkUserExist_whatString,function(err,result){
//                if (result.length > 0) {
//                    //return true;
//                        var chk = mysql_real_escape_string(String(whatUser));
//                        var whatString = "SELECT * FROM usertoken WHERE user='"+chk+"'";
//                        var insertWhat = {user: chk, token: mysql_real_escape_string(whatToken)};
//                        mysqli.query(whatString,function(err,result){
//                                if (result.length > 0) {
//                                        whatString = "DELETE FROM usertoken WHERE user='"+chk+"'";
//                                        mysqli.query(whatString,function(err,result){
//                                                if(err){
//                                                        console.log('Error connecting to Db');
//                                                        console.log(err);
//                                                        
//                                                        return false;
//                                                }
//                                                whatString = 'INSERT INTO usertoken SET ?';
//                                                mysqli.query(whatString, insertWhat, function(err,result){
//                                                        if(err){
//                                                                console.log('Error connecting to Db');
//                                                                console.log(err);
//                                                                
//                                                                return false;
//                                                        }
//                                                });
//                                        });
//                                }
//                                else {
//                                        whatString = 'INSERT INTO usertoken SET ?';
//                                        mysqli.query(whatString, insertWhat, function(err,result){
//                                                if(err){
//                                                        console.log('Error connecting to Db');
//                                                        console.log(err);
//                                                        
//                                                        return false;
//                                                }
//                                        });
//                                }
//                        });
//                }
//        });
//}//!!!check return inside callback
//
//function chkUserToken(whatUser, whatToken) {                    ///!!!
//        
//        var chkUserToken_chkUserExist_chk = mysql_real_escape_string(String(username));
//        var chkUserToken_chkUserExist_whatString = "SELECT * FROM userdata WHERE username='"+chkUserToken_chkUserExist_chk+"'";
//        mysqli.query(chkUserToken_chkUserExist_whatString,function(err,result){
//                if (result.length > 0) {
//                    //return true;
//                        var chk = mysql_real_escape_string(String(whatUser));
//                        var whatString = "SELECT * FROM usertoken WHERE user='"+chk+"'";
//                        mysqli.query(whatString, function(err,result){
//                                if (result.length > 0) {
//                                        if (result[0].token === String(whatToken)) {
//                                                return true;
//                                        }
//                                }
//                                else {
//                                        return false;
//                                }
//                        });
//                }
//                else {
//                        return false;
//                }
//        });
//}

//function chkUserIsBannedFromRoom(whatUser, whatRoom) {
//	var chkroom = mysql_real_escape_string(String(whatRoom));
//	var chkuser = mysql_real_escape_string(String(whatUser));
//	var whatString = "SELECT * FROM bandata WHERE room='"+chkroom+"' AND ban='"+chkuser+"'";
//	mysqli.query(whatString,function(err,result){
//		if (result.length > 0) {
//			return true;
//		}
//		else {
//			return false;
//		}
//	});
//	
//}

//function chkRoomExist(whatRoom) {
//	var chk = mysql_real_escape_string(String(whatRoom));
//	var whatString = "SELECT * FROM roomdata WHERE room='"+chk+"'";
//	mysqli.query(whatString,function(err,result){
//		if (result.length > 0) {
//			return true;
//		}
//		else {
//			return false;
//		}
//	});
//}

//function chkRoomToken(whatRoom, whatToken) {
//	var chkroom = mysql_real_escape_string(String(whatRoom));
//	var chktoken = mysql_real_escape_string(String(whatToken));		//for symmetry
//	var whatString = "SELECT * FROM roomdata WHERE room='"+chkroom+"'";
//        mysqli.query(whatString,function(err,result){
//                if (result.length > 0) {
//                        if (result[0].token === chktoken) {
//                                return true;
//                        }
//                        else {
//                                return false;
//                        }
//                }
//                else {
//                        return false;
//                }
//        });
//}

//function getRoomToken(whatRoom) {
//	var chkroom = mysql_real_escape_string(String(whatRoom));
//	var whatString = "SELECT * FROM roomdata WHERE room='"+chkroom+"'";
//        mysqli.query(whatString,function(err,result){
//                if (result.length > 0) {
//                        return String(result[0].token);
//                }
//                else {
//                        return null;
//                }
//        });
//}

//function getRoomMaster(whatRoom) {
//	var chkroom = mysql_real_escape_string(String(whatRoom));
//	var whatString = "SELECT * FROM roomdata WHERE room='"+chkroom+"'";
//        mysqli.query(whatString,function(err,result){
//                if (result.length > 0) {
//                        return String(result[0].master);
//                }
//                else {
//                        return null;
//                }
//        });
//}

//function getHisMsg(whatRoom) {
//	var historyMsg = [];
//	var whatroom = mysql_real_escape_string(whatRoom);
//	var whatString = "SELECT * FROM msgdata WHERE room='"+whatroom+"' AND privatemsg=0 ORDER BY id DESC LIMIT 50";
//	var whatMsg = {};
//	whatMsg.de = "";
//	whatMsg.msg = "";
//	whatMsg.datetime = "";
//
//	mysqli.query(whatString, function(err,result) {
//		if(err){
//			console.log('Error connecting to Db');
//			console.log(err);
//			return [];
//		}
//		if(result.length>0){
//			for (var i = 0; i < result.length; i++) {
//				whatMsg.de = result[i].de;
//				whatMsg.msg = result[i].msg;
//				whatMsg.datetime = result[i].datetime;
//				historyMsg.push(whatMsg);
//			}
//			historyMsg = historyMsg.reverse();		//so actually this native func is the slowest method, interesting... meh i dont care
//			return historyMsg;
//		}
//		else{
//			return [];
//		}
//	});
//}

//function getLotsOfHisMsg(whatRoom, startAt, endAt) {
//	var historyMsg = [];
//	var whatroom = mysql_real_escape_string(whatRoom);
//	var sa = Number(startAt);
//	var ea = Number(endAt);
//	if (sa > ea) {
//		sa += ea;
//		ea = sa - ea;
//		sa = sa - ea;
//	}
//	var whatString = "SELECT * FROM msgdata WHERE room='"+whatroom+"' AND privatemsg=0 ORDER BY id DESC LIMIT "+String(sa)+", "+String(ea);
//	var whatMsg = {};
//	whatMsg.de = "";
//	whatMsg.msg = "";
//	whatMsg.datetime = "";
//
//	mysqli.query(whatString, function(err,result) {
//		if(err){
//			console.log('Error connecting to Db');
//			console.log(err);
//			return [];
//		}
//		if(result.length>0){
//			for (var i = 0; i < result.length; i++) {
//				whatMsg.de = result[i].de;
//				whatMsg.msg = result[i].msg;
//				whatMsg.datetime = result[i].datetime;
//				historyMsg.push(whatMsg);
//			}
//			historyMsg = historyMsg.reverse();
//			return historyMsg;
//		}
//		else{
//			return [];
//		}
//	});
//}

//function getMsgContaining(whatRoom, keyWord, startAt, endAt) {
//	var historyMsg = [];
//	var whatroom = mysql_real_escape_string(whatRoom);
//	var keyword = mysql_real_escape_string(keyWord);
//	var sa = Number(startAt);
//	var ea = Number(endAt);
//	if (sa > ea) {
//		sa += ea;
//		ea = sa - ea;
//		sa = sa - ea;
//	}
//	var whatString = "SELECT * FROM msgdata WHERE room='"+whatroom+"' AND privatemsg=0 AND msg LIKE '"+keyword+"' ORDER BY id DESC LIMIT "+String(sa)+", "+String(ea);
//	var whatMsg = {};
//	whatMsg.de = "";
//	whatMsg.msg = "";
//	whatMsg.datetime = "";
//
//	mysqli.query(whatString, function(err,result) {
//		if(err){
//			console.log('Error connecting to Db');
//			console.log(err);
//			return [];
//		}
//		if(result.length>0){
//			for (var i = 0; i < result.length; i++) {
//				whatMsg.de = result[i].de;
//				whatMsg.msg = result[i].msg;
//				whatMsg.datetime = result[i].datetime;
//				historyMsg.push(whatMsg);
//			}
//			historyMsg = historyMsg.reverse();
//			return historyMsg;
//		}
//		else{
//			return [];
//		}
//	});
//}

//function chkRoomPwd(whatRoom, whatPwd) {
//	var chkroom = mysql_real_escape_string(String(whatRoom));
//	var chkpwd = mysql_real_escape_string(String(whatPwd));		//for symmetry
//	var whatString = "SELECT * FROM roomdata WHERE room='"+chkroom+"'";
//        mysqli.query(whatString,function(err,result){
//                if (result.length > 0) {
//                        if (!result[0].roompwd) {
//                                if (!String(whatPwd)) {
//                                        return true;
//                                }
//                        }
//                        if (result[0].roompwd === chkpwd) {
//                                return true;
//                        }
//                        else {
//                                return false;
//                        }
//                }
//                else {
//                        return false;
//                }
//        });
//}

//Im not cheating and i cite all sources and that email still scared the heck out of me, i mean seriously, who would risk getting a zero?
//Escape code from http://stackoverflow.com/questions/7744912/making-a-javascript-string-sql-friendly
function mysql_real_escape_string (str) {
        return str;
    //return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
    //    switch (char) {
    //        case "\0":
    //            return "\\0";
    //        case "\x08":
    //            return "\\b";
    //        case "\x09":
    //            return "\\t";
    //        case "\x1a":
    //            return "\\z";
    //        case "\n":
    //            return "\\n";
    //        case "\r":
    //            return "\\r";
    //        case "\"":
    //        case "'":
    //        case "\\":
    //        case "%":
    //            return "\\"+char; // prepends a backslash to backslash, percent,
    //                              // and double/single quotes
    //    }
    //});
}

//oh yeah i can use this to generate dynamic salt why didt i think of that earlier
//All MD5 code by Joseph Myers http://www.myersdaily.org/joseph/javascript/md5-text.html
function md5cycle(x, k) {
var a = x[0], b = x[1], c = x[2], d = x[3];

a = ff(a, b, c, d, k[0], 7, -680876936);
d = ff(d, a, b, c, k[1], 12, -389564586);
c = ff(c, d, a, b, k[2], 17,  606105819);
b = ff(b, c, d, a, k[3], 22, -1044525330);
a = ff(a, b, c, d, k[4], 7, -176418897);
d = ff(d, a, b, c, k[5], 12,  1200080426);
c = ff(c, d, a, b, k[6], 17, -1473231341);
b = ff(b, c, d, a, k[7], 22, -45705983);
a = ff(a, b, c, d, k[8], 7,  1770035416);
d = ff(d, a, b, c, k[9], 12, -1958414417);
c = ff(c, d, a, b, k[10], 17, -42063);
b = ff(b, c, d, a, k[11], 22, -1990404162);
a = ff(a, b, c, d, k[12], 7,  1804603682);
d = ff(d, a, b, c, k[13], 12, -40341101);
c = ff(c, d, a, b, k[14], 17, -1502002290);
b = ff(b, c, d, a, k[15], 22,  1236535329);

a = gg(a, b, c, d, k[1], 5, -165796510);
d = gg(d, a, b, c, k[6], 9, -1069501632);
c = gg(c, d, a, b, k[11], 14,  643717713);
b = gg(b, c, d, a, k[0], 20, -373897302);
a = gg(a, b, c, d, k[5], 5, -701558691);
d = gg(d, a, b, c, k[10], 9,  38016083);
c = gg(c, d, a, b, k[15], 14, -660478335);
b = gg(b, c, d, a, k[4], 20, -405537848);
a = gg(a, b, c, d, k[9], 5,  568446438);
d = gg(d, a, b, c, k[14], 9, -1019803690);
c = gg(c, d, a, b, k[3], 14, -187363961);
b = gg(b, c, d, a, k[8], 20,  1163531501);
a = gg(a, b, c, d, k[13], 5, -1444681467);
d = gg(d, a, b, c, k[2], 9, -51403784);
c = gg(c, d, a, b, k[7], 14,  1735328473);
b = gg(b, c, d, a, k[12], 20, -1926607734);

a = hh(a, b, c, d, k[5], 4, -378558);
d = hh(d, a, b, c, k[8], 11, -2022574463);
c = hh(c, d, a, b, k[11], 16,  1839030562);
b = hh(b, c, d, a, k[14], 23, -35309556);
a = hh(a, b, c, d, k[1], 4, -1530992060);
d = hh(d, a, b, c, k[4], 11,  1272893353);
c = hh(c, d, a, b, k[7], 16, -155497632);
b = hh(b, c, d, a, k[10], 23, -1094730640);
a = hh(a, b, c, d, k[13], 4,  681279174);
d = hh(d, a, b, c, k[0], 11, -358537222);
c = hh(c, d, a, b, k[3], 16, -722521979);
b = hh(b, c, d, a, k[6], 23,  76029189);
a = hh(a, b, c, d, k[9], 4, -640364487);
d = hh(d, a, b, c, k[12], 11, -421815835);
c = hh(c, d, a, b, k[15], 16,  530742520);
b = hh(b, c, d, a, k[2], 23, -995338651);

a = ii(a, b, c, d, k[0], 6, -198630844);
d = ii(d, a, b, c, k[7], 10,  1126891415);
c = ii(c, d, a, b, k[14], 15, -1416354905);
b = ii(b, c, d, a, k[5], 21, -57434055);
a = ii(a, b, c, d, k[12], 6,  1700485571);
d = ii(d, a, b, c, k[3], 10, -1894986606);
c = ii(c, d, a, b, k[10], 15, -1051523);
b = ii(b, c, d, a, k[1], 21, -2054922799);
a = ii(a, b, c, d, k[8], 6,  1873313359);
d = ii(d, a, b, c, k[15], 10, -30611744);
c = ii(c, d, a, b, k[6], 15, -1560198380);
b = ii(b, c, d, a, k[13], 21,  1309151649);
a = ii(a, b, c, d, k[4], 6, -145523070);
d = ii(d, a, b, c, k[11], 10, -1120210379);
c = ii(c, d, a, b, k[2], 15,  718787259);
b = ii(b, c, d, a, k[9], 21, -343485551);

x[0] = add32(a, x[0]);
x[1] = add32(b, x[1]);
x[2] = add32(c, x[2]);
x[3] = add32(d, x[3]);

}

function cmn(q, a, b, x, s, t) {
a = add32(add32(a, q), add32(x, t));
return add32((a << s) | (a >>> (32 - s)), b);
}

function ff(a, b, c, d, x, s, t) {
return cmn((b & c) | ((~b) & d), a, b, x, s, t);
}

function gg(a, b, c, d, x, s, t) {
return cmn((b & d) | (c & (~d)), a, b, x, s, t);
}

function hh(a, b, c, d, x, s, t) {
return cmn(b ^ c ^ d, a, b, x, s, t);
}

function ii(a, b, c, d, x, s, t) {
return cmn(c ^ (b | (~d)), a, b, x, s, t);
}

function md51(s) {
txt = '';
var n = s.length,
state = [1732584193, -271733879, -1732584194, 271733878], i;
for (i=64; i<=s.length; i+=64) {
md5cycle(state, md5blk(s.substring(i-64, i)));
}
s = s.substring(i-64);
var tail = [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
for (i=0; i<s.length; i++)
tail[i>>2] |= s.charCodeAt(i) << ((i%4) << 3);
tail[i>>2] |= 0x80 << ((i%4) << 3);
if (i > 55) {
md5cycle(state, tail);
for (i=0; i<16; i++) tail[i] = 0;
}
tail[14] = n*8;
md5cycle(state, tail);
return state;
}

/* there needs to be support for Unicode here,
 * unless we pretend that we can redefine the MD-5
 * algorithm for multi-byte characters (perhaps
 * by adding every four 16-bit characters and
 * shortening the sum to 32 bits). Otherwise
 * I suggest performing MD-5 as if every character
 * was two bytes--e.g., 0040 0025 = @%--but then
 * how will an ordinary MD-5 sum be matched?
 * There is no way to standardize text to something
 * like UTF-8 before transformation; speed cost is
 * utterly prohibitive. The JavaScript standard
 * itself needs to look at this: it should start
 * providing access to strings as preformed UTF-8
 * 8-bit unsigned value arrays.
 */
function md5blk(s) { /* I figured global was faster.   */
var md5blks = [], i; /* Andy King said do it this way. */
for (i=0; i<64; i+=4) {
md5blks[i>>2] = s.charCodeAt(i) + (s.charCodeAt(i+1) << 8) + (s.charCodeAt(i+2) << 16) + (s.charCodeAt(i+3) << 24);
}
return md5blks;
}

var hex_chr = '0123456789abcdef'.split('');

function rhex(n)
{
var s='', j=0;
for(; j<4; j++)
s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
return s;
}

function hex(x) {
for (var i=0; i<x.length; i++)
x[i] = rhex(x[i]);
return x.join('');
}

function md5(s) {
return hex(md51(s));
}

/* this function is much faster,
so if possible we use it. Some IEs
are the only ones I know of that
need the idiotic second function,
generated by an if clause.  */

function add32(a, b) {
return (a + b) & 0xFFFFFFFF;
}

if (md5('hello') != '5d41402abc4b2a76b9719d911017c592') {
function add32(x, y) {
var lsw = (x & 0xFFFF) + (y & 0xFFFF),
msw = (x >> 16) + (y >> 16) + (lsw >> 16);
return (msw << 16) | (lsw & 0xFFFF);
}
}

function castToString(what) {
        if (typeof(what)!== "number")  {
                if (what) {
                        return String(what);
                }else {
                        return what;
                }
        }
        else {
                return String(what);
        }
}
