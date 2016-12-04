# Messaging-Website
Multi-room chat website

Link
http://52.89.223.118:3456/

->Message History

    User can see previous public messages for the Main Lobby or other public chat room. 
    Click check history on the right side bar and a note pad window will pop up and show you the history messages.
    User can only access public messages, private messages will not be shown.

-> Double Hashtag

    Like the hashtag function on facebook, if a user type in #keyword# (<-remove the backslash for escaping markdowns) in their public       messages, other user can use the keyword and search for it.
    Use can search for any public messages with a double hashtaged keyword.
    
-> Clipboard for Saving Messages

    Users can save any messages they can see, i.e. public messages or private messages directed to them.
    User can also delete the saved messages.
    User can access the saved messages only after entering their password to ensure privacy. Any clipboard related operation will have       to require password.
    
-> Invitation Message

    The creator of the room can send out invitation for the room to anyone online.
    The invitation will be regarded as a private message.
    
-> Unbanning user

    The user who created the room can not only ban but also unban other users
    The other user dose not need to be in the room for them to be banned, remote ban/unbanning.
    The user who created the room can also send a little message to the user he/she unbanned.
-> Easy Recipient Name Loading

    Just click the Send Msg Button on the messages to load the Recipient.
    
-> A Recent Vistor List

    Each room has a recent vistor list on the right bar.
    Unlike the all user list, this list only update when new people joins the room.
    
-> Password Encrypted Before Emitting

    Password of each user is salted and encrypted before emitting, then salted and encrypted again using SHA512 in the backend to ensure     safety, avoiding embarrassing password eavesdropping situation.
    
Nice Looking Chat Room
Improved visual works.
A Little Something Fun
Set VaticanCameos to true to allow a nice show when you receive a response with corrupted type.
Just a easter egg, requires other users to spoof your client side.
