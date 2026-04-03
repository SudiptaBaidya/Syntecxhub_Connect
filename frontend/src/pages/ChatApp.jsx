import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiSearch, FiMessageSquare, FiHash, FiUsers, FiSettings, 
  FiMoreVertical, FiSmile, FiAtSign, FiPlus, FiSend, FiLogOut, FiX, FiTrash2, FiShield, FiBell
} from 'react-icons/fi';
import { BsFileEarmarkText } from 'react-icons/bs';
import axios from 'axios';
import io from 'socket.io-client';
import { format } from 'date-fns';
import EmojiPicker from 'emoji-picker-react';
import './ChatApp.css';

const API_URL = 'http://localhost:5000/api';
const SERVER_URL = 'http://localhost:5000';
let socket;

const getAvatarUrl = (user) => {
  if (!user) return `https://ui-avatars.com/api/?name=User&background=22272E&color=fff`;
  if (user.avatarUrl) {
    if (user.avatarUrl.startsWith('http')) return user.avatarUrl;
    return `${SERVER_URL}${user.avatarUrl}`;
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=22272E&color=fff`;
};

const ChatApp = () => {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  
  // Navigation State
  const [activeTab, setActiveTab] = useState('channels');
  
  // Modals
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);

  // Create Room State
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomIsPrivate, setNewRoomIsPrivate] = useState(false);
  const [newRoomMembers, setNewRoomMembers] = useState([]);

  // Room Settings State
  const [editingRoomName, setEditingRoomName] = useState('');
  
  // UI Interaction States
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState([]);

  // Toast Helper
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [roomMemberSearchQuery, setRoomMemberSearchQuery] = useState('');
  
  // Advanced Features State
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [mentionOptions, setMentionOptions] = useState([]);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [createRoomSearchQuery, setCreateRoomSearchQuery] = useState('');
  
  // Message Action States
  const [msgOptionsMenuId, setMsgOptionsMenuId] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messageToForward, setMessageToForward] = useState(null);
  
  // Profile Edits State
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [isForceUsername, setIsForceUsername] = useState(false);
  const [discoveryRooms, setDiscoveryRooms] = useState([]);
  const [isSearchingDiscovery, setIsSearchingDiscovery] = useState(false);
  
  // Notification & Unread State
  const [notifications, setNotifications] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({}); // { roomId: count }
  const [showNotifications, setShowNotifications] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    const user = localStorage.getItem('userInfo');
    if (!user) {
      navigate('/signin');
    } else {
      const parsedUser = JSON.parse(user);
      setUserInfo(parsedUser);
      setEditFullName(parsedUser.fullName || '');
      setEditUsername(parsedUser.username || '');
      setEditBio(parsedUser.bio || '');
      setEditAvatarUrl(parsedUser.avatarUrl || '');
      
      if (!parsedUser.username) {
        setIsForceUsername(true);
        setShowProfileSettings(true);
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (!userInfo) return;
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };

    const fetchInitialData = async () => {
      try {
        const [roomsRes, usersRes, notificationsRes] = await Promise.all([
          axios.get(`${API_URL}/chat/rooms`, config),
          axios.get(`${API_URL}/chat/users`, config),
          axios.get(`${API_URL}/users/notifications`, config)
        ]);
        setRooms(roomsRes.data);
        setUsers(usersRes.data);
        setNotifications(notificationsRes.data);
        
        // Initial unread counts calculation (optional, but good for persistence)
        // For now, let's just use ephemeral counts and improve if needed
      } catch (err) {
        console.error("Failed to fetch initial data", err);
      }
    };

    fetchInitialData();
    socket = io('http://localhost:5000');
    socket.emit('userOnline', userInfo._id);

    socket.on('userStatusUpdate', ({ userId, status }) => {
      setUsers((prev) => prev.map(u => u._id === userId ? { ...u, status } : u));
    });

    return () => {
      socket.off('userStatusUpdate');
      socket.disconnect();
    };
  }, [userInfo]);

  // Fetch Discovery rooms on sidebar search
  useEffect(() => {
    if (!userInfo || activeTab === 'contacts') return;
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    
    const searchRooms = async () => {
      if (sidebarSearchQuery.length < 2) {
        setDiscoveryRooms([]);
        return;
      }
      setIsSearchingDiscovery(true);
      try {
        const { data } = await axios.get(`${API_URL}/chat/rooms/discover?searchQuery=${sidebarSearchQuery}`, config);
        setDiscoveryRooms(data);
      } catch (err) {
        console.error("Discovery search failed", err);
      } finally {
        setIsSearchingDiscovery(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      searchRooms();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [sidebarSearchQuery, userInfo, activeTab]);

  // Fetch Recommended Rooms if sidebar search is empty
  useEffect(() => {
    if (!userInfo || activeTab !== 'channels' || sidebarSearchQuery) return;
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    
    const fetchRecommendations = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/chat/rooms/discover`, config);
        setDiscoveryRooms(data);
      } catch (err) {
        console.error("Failed to fetch recommendations", err);
      }
    };
    fetchRecommendations();
  }, [userInfo, activeTab, sidebarSearchQuery]);

  // Fetch Users on Contact search
  useEffect(() => {
    if (!userInfo || activeTab !== 'contacts' || !contactSearchQuery) {
        if (!contactSearchQuery) setUsers([]);
        return;
    }
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    
    const searchPeople = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/chat/users?searchQuery=${contactSearchQuery}`, config);
        setUsers(data);
      } catch (err) {
        console.error("Contact search failed", err);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      searchPeople();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [contactSearchQuery, userInfo, activeTab]);

  useEffect(() => {
    if (!activeRoom || !userInfo) return;
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    const fetchMessages = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/chat/messages/${activeRoom._id}`, config);
        setMessages(data);
      } catch (err) {
        console.error("Failed to fetch messages", err);
      }
    };
    fetchMessages();
    socket.emit('joinRoom', { roomId: activeRoom._id });

    socket.on('message', (newMessage) => {
       if (newMessage.room === activeRoom?._id) {
         setMessages((prev) => [...prev, newMessage]);
       } else {
         // Increment unread count for other rooms
         setUnreadCounts(prev => ({
           ...prev,
           [newMessage.room]: (prev[newMessage.room] || 0) + 1
         }));
       }
    });

    socket.on('messageUpdate', (updatedMessage) => {
      setMessages((prev) => prev.map((msg) => msg._id === updatedMessage._id ? updatedMessage : msg));
    });

    socket.on('messageDelete', (deletedId) => {
       setMessages((prev) => prev.filter(m => m._id !== deletedId));
    });

    socket.on('roomUpdate', (updatedRoom) => {
       setRooms(prev => prev.map(r => r._id === updatedRoom._id ? updatedRoom : r));
       if (activeRoom?._id === updatedRoom._id) {
          setActiveRoom(updatedRoom);
       }
    });

    socket.on('notification', (newNotification) => {
      setNotifications(prev => [newNotification, ...prev]);
      showToast(newNotification.content, 'info');
      // Potential sound play here
    });

    return () => {
      socket.off('message');
      socket.off('messageUpdate');
      socket.off('messageDelete');
      socket.off('roomUpdate');
      socket.off('notification');
    };
  }, [activeRoom, userInfo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !activeRoom) return;
    socket.emit('chatMessage', {
      senderId: userInfo._id,
      roomId: activeRoom._id,
      content: messageInput,
    });
    setMessageInput('');
  };

  const handleMessageChange = (e) => {
    const val = e.target.value;
    setMessageInput(val);
    
    const lastWord = val.split(' ').pop();
    if (lastWord.startsWith('@')) {
       const query = lastWord.slice(1).toLowerCase();
       const matches = activeRoom?.members?.filter(m => m.fullName.toLowerCase().includes(query)) || [];
       setMentionOptions(matches);
    } else {
       setMentionOptions([]);
    }
  };

  const insertMention = (user) => {
     const words = messageInput.split(' ');
     words.pop();
     setMessageInput([...words, `@${user.fullName}`].join(' ') + ' ');
     setMentionOptions([]);
  };

  const handleCopyMessage = (msg) => {
    navigator.clipboard.writeText(msg.content);
    setMsgOptionsMenuId(null);
  };

  const startEditing = (msg) => {
    setEditingMessage(msg);
    setMessageInput(msg.content);
    setMsgOptionsMenuId(null);
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setMessageInput('');
  };

  const handleEditMessage = async () => {
    if (!messageInput.trim() || !editingMessage) return;
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    try {
      const { data } = await axios.put(`${API_URL}/chat/messages/${editingMessage._id}`, { content: messageInput }, config);
      socket.emit('messageUpdate', data);
      setEditingMessage(null);
      setMessageInput('');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to edit message', 'error');
    }
  };

  const handleDeleteMessage = async (msg, mode) => {
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    try {
      if (mode === 'everyone') {
        const { data } = await axios.delete(`${API_URL}/chat/messages/${msg._id}/everyone`, config);
        socket.emit('messageDelete', { messageId: data.messageId, roomId: data.roomId });
      } else {
        await axios.delete(`${API_URL}/chat/messages/${msg._id}/me`, config);
        setMessages((prev) => prev.filter(m => m._id !== msg._id));
      }
      setMsgOptionsMenuId(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete message', 'error');
    }
  };

  const openForwardModal = (msg) => {
    setMessageToForward(msg);
    setShowForwardModal(true);
    setMsgOptionsMenuId(null);
  };

  const handleForwardMessage = async (roomId) => {
    if (!messageToForward) return;
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    try {
      const forwardData = {
        content: `[Forwarded]: ${messageToForward.content}`,
        fileUrl: messageToForward.fileUrl,
        fileName: messageToForward.fileName,
        fileSize: messageToForward.fileSize
      };
      
      const { data } = await axios.post(`${API_URL}/chat/messages/${roomId}/forward`, forwardData, config);
      socket.emit('broadcastMessage', data);
      setShowForwardModal(false);
      setMessageToForward(null);
      showToast('Message forwarded!', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to forward message', 'error');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeRoom) return;

    const formData = new FormData();
    formData.append('file', file);

    const config = { 
      headers: { Authorization: `Bearer ${userInfo.token}`, 'Content-Type': 'multipart/form-data' } 
    };

    try {
      const { data } = await axios.post(`${API_URL}/chat/messages/${activeRoom._id}/upload`, formData, config);
      socket.emit('broadcastMessage', data);
      e.target.value = null; // reset
    } catch (err) {
       showToast(err.response?.data?.message || 'Failed to upload file', 'error');
    }
  };

  const startDirectMessage = async (targetUser) => {
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    try {
      const { data } = await axios.post(`${API_URL}/chat/rooms/direct`, { targetUserId: targetUser._id }, config);
      if (!rooms.find(r => r._id === data._id)) {
        setRooms([...rooms, data]);
      }
      setActiveTab('messages');
      setActiveRoom(data);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to start direct message', 'error');
    }
  };

  const handleCreateRoomSubmit = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    try {
      const { data } = await axios.post(`${API_URL}/chat/rooms`, { 
        name: newRoomName, 
        type: newRoomIsPrivate ? 'private' : 'public',
        members: newRoomIsPrivate ? newRoomMembers : []
      }, config);
      
      setRooms([...rooms, data]);
      setActiveRoom(data);
      setActiveTab(newRoomIsPrivate ? 'messages' : 'channels');
      setShowCreateModal(false);
      
      // Reset state
      setNewRoomName('');
      setNewRoomIsPrivate(false);
      setNewRoomMembers([]);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create room', 'error');
    }
  };

  const toggleMemberSelection = (userId) => {
    if (newRoomMembers.includes(userId)) {
      setNewRoomMembers(newRoomMembers.filter(id => id !== userId));
    } else {
      setNewRoomMembers([...newRoomMembers, userId]);
    }
  };

  const handleRenameRoom = async () => {
    if (!editingRoomName.trim() || editingRoomName === activeRoom.name) return;
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    try {
      const { data } = await axios.put(`${API_URL}/chat/rooms/${activeRoom._id}`, { name: editingRoomName }, config);
      setRooms(rooms.map(r => r._id === data._id ? data : r));
      setActiveRoom(data);
      showToast('Room renamed successfully!', 'success');
      setEditingRoomName('');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to rename room', 'error');
    }
  };

  const handleDeleteRoom = async () => {
    if (!window.confirm(`Are you sure you want to delete ${activeRoom.name}? This cannot be undone.`)) return;
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    try {
      await axios.delete(`${API_URL}/chat/rooms/${activeRoom._id}`, config);
      setRooms(rooms.filter(r => r._id !== activeRoom._id));
      setActiveRoom(null);
      setShowRoomSettings(false);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete room', 'error');
    }
  };

  const handleLeaveRoom = async () => {
    if (!window.confirm(`Are you sure you want to leave ${activeRoom.name}?`)) return;
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    try {
      await axios.post(`${API_URL}/chat/rooms/${activeRoom._id}/leave`, {}, config);
      setRooms(rooms.filter(r => r._id !== activeRoom._id));
      setActiveRoom(null);
      setShowOptionsMenu(false);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to leave room', 'error');
    }
  };

  const handleManageRole = async (targetUserId, action) => {
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    try {
      const { data } = await axios.post(`${API_URL}/chat/rooms/${activeRoom._id}/admins`, { targetUserId, action }, config);
      setRooms(rooms.map(r => r._id === data._id ? data : r));
      setActiveRoom(data);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to manage roles', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userInfo');
    navigate('/signin');
  };

  const handleUpdateProfile = async (e) => {
    if (e) e.preventDefault();
    if (!editUsername.trim()) {
       showToast("Username is required", "error");
       return;
    }
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    try {
      const { data } = await axios.put(`${API_URL}/users/profile`, {
        fullName: editFullName,
        username: editUsername,
        bio: editBio,
        avatarUrl: editAvatarUrl
      }, config);
      
      const updatedUserInfo = { ...userInfo, ...data };
      setUserInfo(updatedUserInfo);
      localStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
      setIsForceUsername(false);
      setShowProfileSettings(false);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update profile', 'error');
    }
  };

  const handleAvatarUpdate = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    const config = { 
      headers: { Authorization: `Bearer ${userInfo.token}`, 'Content-Type': 'multipart/form-data' } 
    };

    try {
      const { data } = await axios.post(`${API_URL}/users/avatar`, formData, config);
      setEditAvatarUrl(data.avatarUrl);
      // Update the main state too
      const updatedUserInfo = { ...userInfo, avatarUrl: data.avatarUrl };
      setUserInfo(updatedUserInfo);
      localStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to upload avatar', 'error');
    }
  };

  const handleMarkNotificationsRead = async () => {
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    try {
      await axios.put(`${API_URL}/users/notifications/read`, {}, config);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Failed to mark notifications as read", err);
    }
  };

  const handleToggleContact = async (targetId) => {
    if (!userInfo) return;
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    try {
      const { data } = await axios.post(`${API_URL}/users/contacts/${targetId}`, {}, config);
      setUserInfo(prev => ({
        ...prev,
        contacts: data.isContact 
          ? [...(prev.contacts || []), targetId] 
          : (prev.contacts || []).filter(id => id.toString() !== targetId)
      }));
      showToast(data.message, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update contact', 'error');
    }
  };

  const handleJoinRoom = async (roomId) => {
    if (!userInfo) return;
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
    try {
      const { data } = await axios.post(`${API_URL}/chat/rooms/${roomId}/join`, {}, config);
      setRooms(prev => [...prev, data]);
      setActiveRoom(data);
      setDiscoveryRooms(prev => prev.filter(r => r._id !== roomId));
      showToast('Joined room successfully!', 'success');
      socket.emit('joinRoom', { roomId: data._id });
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to join room', 'error');
    }
  };

  const getPrivateRoomName = (room, useUsername = false) => {
    if (room.type === 'public') return room.name;
    // Standard Private DM without owner: show other person's name info
    if (!room.owner) {
        const otherMember = room.members.find(m => m._id !== userInfo._id);
        if (otherMember) {
            return useUsername ? (otherMember.username || otherMember.fullName) : otherMember.fullName;
        }
        return 'Direct Message';
    }
    // Private Group Chat with an owner: show custom name
    return room.name;
  };

  if (!userInfo) return null;

  const displayRooms = rooms.filter(r => {
    const isTabMatch = activeTab === 'messages' ? r.type === 'private' : r.type === 'public';
    if (!isTabMatch) return false;
    const name = getPrivateRoomName(r).toLowerCase();
    return name.includes(sidebarSearchQuery.toLowerCase());
  });

  const displayUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(sidebarSearchQuery.toLowerCase()) || 
    (u.username && u.username.toLowerCase().includes(sidebarSearchQuery.toLowerCase()))
  );

  const isRoomOwner = activeRoom?.owner === userInfo._id;
  const isRoomAdmin = activeRoom?.admins?.includes(userInfo._id);

  const handleSetActiveRoom = (room) => {
    setActiveRoom(room);
    // Clear unread count when clicking a room
    setUnreadCounts(prev => ({
      ...prev,
      [room._id]: 0
    }));
  };

  return (
    <div className="chat-layout">
      {/* LEFT SIDEBAR */}
      <aside className="sidebar-left">
        <div className="brand-section">
          <div className="brand-logo-small">
            <span style={{color: '#fff', fontWeight: 'bold', fontSize: '18px'}}>C</span>
          </div>
          <h1>Connect</h1>
        </div>

        <div className="search-rooms">
          <div className="search-input-wrap">
            <FiSearch className="search-icon" />
            <input 
              type="text" 
              placeholder="Search" 
              value={sidebarSearchQuery}
              onChange={(e) => setSidebarSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ul className="nav-menu">
           <li className={`nav-item ${activeTab === 'channels' ? 'active' : ''}`} onClick={() => setActiveTab('channels')}>
            <FiHash /> Channels
          </li>
          <li className={`nav-item ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}>
            <FiMessageSquare /> Messages
          </li>
          <li className={`nav-item ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => setActiveTab('contacts')}>
            <FiUsers /> Contacts
          </li>
        </ul>

        {activeTab !== 'contacts' && (
          <div className="sidebar-middle-scroll">
            <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               {activeTab === 'messages' ? 'PRIVATE ROOMS & DMs' : 'CHANNELS'}
               <FiPlus onClick={() => setShowCreateModal(true)} style={{cursor: 'pointer', fontSize: '14px', color:'var(--text-primary)'}} />
            </div>
            <div className="room-list">
              {displayRooms.map(room => (
                <div 
                  key={room._id}
                  className={`room-item ${activeRoom?._id === room._id ? 'active' : ''}`}
                  onClick={() => handleSetActiveRoom(room)}
                >
                  <div className="room-item-name" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                      {room.type === 'public' ? (
                        <><span style={{color:'var(--text-muted)'}}>#</span> {room.name}</>
                      ) : (
                        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                            <div className="status-dot" style={{position:'static', width:'8px', height:'8px', border:'none'}}></div>
                            {getPrivateRoomName(room)}
                        </div>
                      )}
                    </div>
                    {unreadCounts[room._id] > 0 && (
                      <span className="unread-badge">{unreadCounts[room._id]}</span>
                    )}
                  </div>
                </div>
              ))}
              {displayRooms.length === 0 && (
                 <div style={{color: 'var(--text-muted)', fontSize: '12px', padding: '10px 12px'}}>
                    {activeTab === 'messages' ? 'No private groups or DMs.' : 'No joined channels.'}
                 </div>
              )}
            </div>

            {activeTab === 'channels' && (
              <>
                <div className="section-label" style={{ marginTop: '20px' }}>
                   {sidebarSearchQuery ? 'SEARCH RESULTS' : 'RECOMMENDED CHANNELS'}
                </div>
                <div className="room-list">
                  {discoveryRooms.map(room => (
                    <div 
                      key={room._id}
                      className={`room-item ${activeRoom?._id === room._id ? 'active' : ''} discovery`}
                      onClick={() => handleSetActiveRoom(room)}
                    >
                      <div className="room-item-name" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                           <span style={{color:'var(--text-muted)'}}>#</span> {room.name}
                        </div>
                        {unreadCounts[room._id] > 0 && (
                          <span className="unread-badge">{unreadCounts[room._id]}</span>
                        )}
                      </div>
                      <div className="discovery-join-badge" onClick={(e) => { e.stopPropagation(); handleJoinRoom(room._id); }}>Join</div>
                    </div>
                  ))}
                  {discoveryRooms.length === 0 && (
                    <div style={{color: 'var(--text-muted)', fontSize: '12px', padding: '10px 12px'}}>
                      {sidebarSearchQuery ? 'No public channels found.' : 'All public channels joined!'}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="sidebar-bottom">
          <div className="nav-item" style={{ padding: '8px 0', marginBottom: '16px' }} onClick={() => setShowProfileSettings(true)}>
             <FiSettings /> Settings
          </div>
          <div className="user-profile-sm" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="avatar-wrapper" onClick={() => setShowProfileSettings(true)} style={{cursor: 'pointer'}}>
                <img src={getAvatarUrl(userInfo)} alt="Me" className="avatar" />
                <div className="status-dot"></div>
              </div>
              <div className="user-info-sm">
                <h4>{userInfo.fullName}</h4>
                <p>Online</p>
              </div>
            </div>
            <FiLogOut onClick={handleLogout} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} title="Logout" />
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      {activeTab === 'contacts' ? (
         <div className="contacts-view">
            <div className="contacts-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px'}}>
               <div>
                 <h2 style={{margin: '0 0 8px 0'}}>Platform Directory</h2>
                 <p style={{margin: 0}}>Connect with other members of your workspace securely.</p>
               </div>
               <div className="search-input-wrap" style={{width: '100%', maxWidth: '300px'}}>
                 <FiSearch className="search-icon" />
                 <input 
                   type="text" 
                   placeholder="Search by name or email..." 
                   value={contactSearchQuery}
                   onChange={e => setContactSearchQuery(e.target.value)}
                   style={{width: '100%', padding: '10px 10px 10px 34px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)'}}
                 />
               </div>
            </div>
            <div className="contacts-grid">
               {users.map(user => (
                  <div className="contact-card" key={user._id}>
                     <img 
                       src={getAvatarUrl(user)} 
                       alt={user.fullName} 
                       className="contact-avatar" 
                       onClick={() => { setViewingUser(user); setShowUserProfile(true); }}
                       style={{cursor: 'pointer'}}
                     />
                     <div className="contact-name" onClick={() => { setViewingUser(user); setShowUserProfile(true); }} style={{cursor: 'pointer'}}>{user.fullName}</div>
                     <div className="contact-username" style={{color: 'var(--primary-blue)', fontSize: '13px', marginBottom: '12px'}}>@{user.username || 'user'}</div>
                     <div style={{display: 'flex', gap: '8px', width: '100%'}}>
                       <button className="btn-message" style={{flex: 1, padding: '8px'}} onClick={() => startDirectMessage(user)}>
                          Message
                       </button>
                       <button 
                         className={`btn-secondary ${userInfo?.contacts?.includes(user._id) ? 'active' : ''}`} 
                         style={{padding: '8px 12px', background: userInfo?.contacts?.includes(user._id) ? 'var(--primary-blue)' : 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)'}}
                         onClick={() => handleToggleContact(user._id)}
                       >
                          {userInfo?.contacts?.includes(user._id) ? 'Following' : 'Follow'}
                       </button>
                     </div>
                  </div>
               ))}
               {users.length === 0 && (
                 <div className="empty-state-view" style={{gridColumn: '1/-1', height: '300px'}}>
                    <FiUsers className="empty-state-icon" style={{fontSize: '48px', opacity: 0.1}} />
                    <p style={{color:'var(--text-muted)'}}>
                      {contactSearchQuery ? 'No users found matching your search.' : 'Search for users by name or username to start a conversation.'}
                    </p>
                 </div>
               )}
            </div>
         </div>
      ) : (
          <main className="chat-main">
            {activeRoom ? (
              <>
                <header className="chat-header">
                  <div className="chat-title">
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      {activeRoom.type === 'public' ? (
                         <FiHash size={20} style={{color: 'var(--primary-blue)'}} />
                      ) : (
                         <div className="status-dot" style={{position:'static', width:'10px', height:'10px', border:'none'}}></div>
                      )}
                      <div>
                         <h2 style={{margin: 0}}>{getPrivateRoomName(activeRoom)}</h2>
                         <p style={{margin: 0, fontSize: '12px', color: 'var(--text-secondary)'}}>{activeRoom.description || 'Active Chat Session'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="header-actions">
                    <div className="notification-bell-wrapper" style={{position: 'relative', marginRight: '10px'}}>
                      <FiBell className="header-icon" onClick={() => { setShowNotifications(!showNotifications); if(!showNotifications) handleMarkNotificationsRead(); }} />
                      {notifications.some(n => !n.isRead) && (
                        <span className="notification-badge-dot"></span>
                      )}
                      
                      {showNotifications && (
                        <div className="notifications-dropdown" style={{position: 'absolute', top: '100%', right: '0', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', width: '320px', zIndex: 1000, marginTop: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden'}}>
                          <div style={{padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)'}}>
                            <span style={{fontWeight: 'bold', fontSize: '14px'}}>Notifications</span>
                            <span style={{fontSize: '11px', color: 'var(--text-muted)'}}>{notifications.filter(n => !n.isRead).length} Unread</span>
                          </div>
                          <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                            {notifications.length > 0 ? (
                              notifications.map(n => (
                                <div key={n._id} className={`notification-item ${!n.isRead ? 'unread' : ''}`} style={{padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '12px', cursor: 'pointer', transition: 'background 0.2s'}}>
                                  <img src={getAvatarUrl(n.sender)} alt={n.sender?.fullName} style={{width: '36px', height: '36px', borderRadius: '50%'}} />
                                  <div style={{flex: 1}}>
                                    <div style={{fontSize: '13px', color: 'var(--text-primary)', marginBottom: '2px'}}>
                                      <span style={{fontWeight: 'bold'}}>@{n.sender?.username}</span> {n.content}
                                    </div>
                                    <div style={{fontSize: '10px', color: 'var(--text-muted)'}}>{format(new Date(n.createdAt), 'MMM d, hh:mm a')}</div>
                                  </div>
                                  {!n.isRead && <div style={{width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-blue)', marginTop: '5px'}}></div>}
                                </div>
                              ))
                            ) : (
                              <div style={{padding: '30px', textAlign: 'center', color: 'var(--text-muted)'}}>
                                <FiBell size={24} style={{opacity: 0.2, marginBottom: '10px'}} />
                                <p style={{fontSize: '13px'}}>No notifications yet</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <FiUsers className="header-icon" title="View Members" onClick={() => setShowRoomSettings(true)} />
                    {activeRoom.members.some(m => m._id === userInfo._id) ? (
                      <>
                        <FiSearch className="header-icon" title="Search Messages" onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); }} />
                        {activeRoom.owner === userInfo._id && (
                          <FiSettings className="header-icon" onClick={() => {
                            setEditingRoomName(activeRoom.name);
                            setShowRoomSettings(true);
                          }}/>
                        )}
                        <div style={{position: 'relative', display: 'flex'}}>
                          <FiMoreVertical className="header-icon" title="More Options" onClick={() => setShowOptionsMenu(!showOptionsMenu)} />
                          {showOptionsMenu && (
                              <div className="dropdown-menu" style={{position:'absolute', right:0, top:'100%', background:'var(--bg-surface)', border:'1px solid var(--border-color)', borderRadius:'8px', padding:'5px', minWidth:'150px', zIndex:100, marginTop: '5px'}}>
                                <div className="dropdown-item" onClick={() => { setShowOptionsMenu(false); setShowRoomSettings(true); }} style={{padding:'8px 12px', cursor:'pointer', fontSize:'14px'}}>⚙️ Room Settings</div>
                                {activeRoom.owner !== userInfo._id && <div className="dropdown-item" onClick={handleLeaveRoom} style={{padding:'8px 12px', cursor:'pointer', fontSize:'14px', color:'#ef4444'}}>🚪 Leave Room</div>}
                              </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <button className="btn-send" style={{width: 'auto', padding: '5px 15px'}} onClick={() => handleJoinRoom(activeRoom._id)}>Join Channel</button>
                    )}
                  </div>
                </header>

                {showSearch && (
                  <div style={{ padding: '10px 20px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                     <input 
                        type="text" 
                        placeholder="Search messages..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-dark)', color: 'var(--text-primary)' }}
                        autoFocus
                     />
                  </div>
                )}

                {activeRoom.members.some(m => m._id === userInfo._id) ? (
                  <>
                    <div className="message-timeline">
                      {messages.length > 0 ? (
                        messages.filter(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase())).map((msg) => {
                          const isMe = msg.sender._id === userInfo._id;
                          return (
                            <div key={msg._id} className={`message-item ${isMe ? 'me' : ''}`}>
                              {!isMe && (
                                <img 
                                  src={getAvatarUrl(msg.sender)} 
                                  alt={msg.sender.fullName} 
                                  className="avatar" 
                                  onClick={() => { setViewingUser(msg.sender); setShowUserProfile(true); }}
                                  style={{cursor: 'pointer'}}
                                />
                              )}
                              <div className="message-content-wrapper">
                                <div className="message-meta" style={{ justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                  {!isMe && <span className="message-author" style={{color: 'var(--primary-blue)', cursor: 'pointer'}} onClick={() => { setViewingUser(msg.sender); setShowUserProfile(true); }}>{msg.sender.fullName}</span>}
                                  <span className="message-time">{format(new Date(msg.createdAt), 'hh:mm a')}</span>
                                  {isMe && <span style={{fontSize: '12px', fontWeight: 600, cursor: 'pointer'}} onClick={() => setShowProfileSettings(true)}>You</span>}
                                </div>
                                <div className="message-bubble" style={{ position: 'relative' }}>
                                  {msg.isDeleted ? (
                                    <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '13px' }}>
                                      <FiTrash2 size={12} style={{marginRight: '4px'}} /> This message was deleted
                                    </span>
                                  ) : (
                                    <>
                                      {msg.content}
                                      {msg.isEdited && <span style={{fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px'}}>(edited)</span>}
                                      {msg.fileUrl && (
                                        <div className="message-attachment" style={{marginTop:'8px'}}>
                                          {msg.fileUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) ? (
                                              <img src={`${SERVER_URL}${msg.fileUrl}`} alt={msg.fileName} style={{maxWidth:'250px', borderRadius:'8px', display:'block'}} />
                                          ) : (
                                              <a href={`${SERVER_URL}${msg.fileUrl}`} target="_blank" rel="noreferrer" style={{display:'flex', alignItems:'center', gap:'8px', padding:'8px 12px', background:'var(--bg-dark)', borderRadius:'6px', textDecoration:'none', color:'var(--text-primary)'}}>
                                                <BsFileEarmarkText /> 
                                                <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{msg.fileName}</span>
                                                <span style={{fontSize:'12px', color:'var(--text-muted)'}}>{msg.fileSize}</span>
                                              </a>
                                          )}
                                        </div>
                                      )}
                                    </>
                                  )}
                                  
                                  {!msg.isDeleted && (
                                    <div className="msg-action-trigger" onClick={() => setMsgOptionsMenuId(msg._id)} style={{ position: 'absolute', right: isMe ? '-30px' : 'auto', left: isMe ? 'auto' : '-30px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', opacity: 0.6 }}>
                                      <FiMoreVertical size={14} />
                                    </div>
                                  )}

                                  {msgOptionsMenuId === msg._id && (
                                    <div className="dropdown-menu" style={{ position: 'absolute', right: isMe ? '0' : '-160px', left: isMe ? 'auto' : 'auto', top: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '5px', minWidth: '150px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', marginTop: '5px' }} onMouseLeave={() => setMsgOptionsMenuId(null)}>
                                      <div className="dropdown-item" onClick={() => handleCopyMessage(msg)} style={{padding:'8px 12px', cursor:'pointer', fontSize:'13px', display:'flex', alignItems:'center', gap:'8px'}}>📋 Copy Text</div>
                                      <div className="dropdown-item" onClick={() => openForwardModal(msg)} style={{padding:'8px 12px', cursor:'pointer', fontSize:'13px', display:'flex', alignItems:'center', gap:'8px'}}>⏩ Forward</div>
                                      {isMe && (
                                        <div className="dropdown-item" onClick={() => startEditing(msg)} style={{padding:'8px 12px', cursor:'pointer', fontSize:'13px', display:'flex', alignItems:'center', gap:'8px'}}>✏️ Edit</div>
                                      )}
                                      <div className="dropdown-item" onClick={() => handleDeleteMessage(msg, 'me')} style={{padding:'8px 12px', cursor:'pointer', fontSize:'13px', display:'flex', alignItems:'center', gap:'8px'}}>🗑️ Delete for Me</div>
                                      {(isMe || isRoomOwner || isRoomAdmin) && (
                                        <div className="dropdown-item" onClick={() => handleDeleteMessage(msg, 'everyone')} style={{padding:'8px 12px', cursor:'pointer', fontSize:'13px', display:'flex', alignItems:'center', gap:'8px', color:'#ef4444'}}>🔥 Delete for Everyone</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="empty-state-view">
                          <FiMessageSquare className="empty-state-icon" style={{fontSize: '48px', opacity: 0.2}} />
                          <h3>No messages yet</h3>
                          <p>Be the first to start the conversation in {getPrivateRoomName(activeRoom)}!</p>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    <div className="chat-input-area" style={{ position: 'relative' }}>
                      {mentionOptions.length > 0 && (
                        <div className="mention-dropdown" style={{ position: 'absolute', bottom: '100%', left: '80px', marginBottom: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', width: '250px', zIndex: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                          <div style={{padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold'}}>MENTION A MEMBER</div>
                          {mentionOptions.map(user => (
                            <div key={user._id} onClick={() => insertMention(user)} className="mention-item" style={{padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                                <img src={getAvatarUrl(user)} alt={user.fullName} style={{width:'24px', height:'24px', borderRadius:'50%'}} />
                                <span style={{fontSize: '14px', color: 'var(--text-primary)'}}>{user.fullName}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {showEmojiPicker && (
                        <div style={{ position: 'absolute', bottom: '100%', right: '80px', marginBottom: '10px', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', borderRadius: '8px' }}>
                          <EmojiPicker theme="dark" onEmojiClick={(emojiObject) => {
                            setMessageInput(prev => prev + emojiObject.emoji);
                            setShowEmojiPicker(false);
                          }} />
                        </div>
                      )}
                      <div className="input-wrapper">
                        {editingMessage ? (
                          <button className="input-action-btn" title="Cancel Edit" onClick={cancelEditing} style={{color:'#ef4444'}}>
                            <FiX />
                          </button>
                        ) : (
                          <button className="input-action-btn" title="Upload File" onClick={() => document.getElementById('file-upload').click()}>
                            <FiPlus />
                          </button>
                        )}
                        <input type="file" id="file-upload" style={{display: 'none'}} onChange={handleFileUpload} />
                        <input 
                          type="text" 
                          className="chat-input" 
                          placeholder={editingMessage ? `Editing message...` : `Message ${activeRoom.type === 'public' ? '#' : '@'}${getPrivateRoomName(activeRoom, activeRoom.type === 'private' && !activeRoom.owner)}`}
                          value={messageInput}
                          onChange={handleMessageChange}
                          onKeyDown={(e) => { 
                            if(e.key === 'Enter') {
                              if (editingMessage) handleEditMessage();
                              else handleSendMessage();
                            }
                            if(e.key === 'Escape' && editingMessage) cancelEditing();
                          }}
                        />
                        <button className="input-action-btn" title="Add Emoji" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                          <FiSmile />
                        </button>
                        <button className="input-action-btn" title="Mention User" onClick={() => {
                          const newVal = messageInput + '@';
                          setMessageInput(newVal);
                          const matches = activeRoom?.members || [];
                          setMentionOptions(matches);
                        }}>
                          <FiAtSign />
                        </button>
                        <button className="btn-send" onClick={editingMessage ? handleEditMessage : handleSendMessage}>
                          {editingMessage ? 'Save' : 'Send'} <FiSend size={12} />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state-view" style={{flex: 1}}>
                    <FiShield className="empty-state-icon" style={{fontSize: '64px', opacity: 0.1, marginBottom: '20px'}} />
                    <h2>Joined Room Access Only</h2>
                    <p>You must join this channel to view conversation history and send messages.</p>
                    <button className="btn-primary" style={{marginTop: '30px', padding: '12px 30px'}} onClick={() => handleJoinRoom(activeRoom._id)}>
                       Join {activeRoom.name}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state-view">
                  <div className="empty-state-icon">
                     <FiMessageSquare />
                  </div>
                  <h2>Welcome to Connect</h2>
                  <p>Select a channel or direct message to start chatting with your platform members.</p>
                  <div style={{marginTop: '20px'}}>
                     <button className="btn-primary" style={{width: 'auto', padding: '10px 24px'}} onClick={() => setShowCreateModal(true)}>
                        <FiPlus /> Create a Room
                     </button>
                  </div>
              </div>
            )}
          </main>
      )}

      {/* RIGHT SIDEBAR */}
      <aside className="sidebar-right">
        <h3 className="right-section-title">ONLINE &mdash; {users.filter(u => u.status === 'online' || u.status === 'away').length}</h3>
        <div className="online-users">
          {users.map(user => (
            <div className="user-item-sm" key={user._id} style={{cursor: 'pointer'}} onClick={() => { setViewingUser(user); setShowUserProfile(true); }} title="View Profile">
              <div className="avatar-wrapper">
                <img src={getAvatarUrl(user)} alt={user.fullName} className="avatar" />
                <div className="status-dot" style={{ background: user.status === 'online' ? 'var(--green-online)' : user.status === 'away' ? 'var(--yellow-away)' : 'var(--text-muted)' }}></div>
              </div>
              <div className="user-item-name">
                <h4>{user.fullName}</h4>
                <p>@{user.username || 'user'}</p>
              </div>
            </div>
          ))}
        </div>

        {activeRoom && activeTab !== 'contacts' && (
           <>
              <h3 className="right-section-title">SHARED FILES</h3>
              <div className="shared-files">
                <div className="file-card">
                  <div className="file-icon">
                    <BsFileEarmarkText />
                  </div>
                  <div className="file-info">
                    <h4>No files shared.</h4>
                    <p>Be the first!</p>
                  </div>
                </div>
              </div>
           </>
        )}
      </aside>

      {/* Profile Settings Modal Overlay */}
      {showProfileSettings && (
         <div className="modal-overlay" onClick={(e) => { if(e.target === e.currentTarget && !isForceUsername) setShowProfileSettings(false); }}>
            <div className="settings-modal" style={{width: '400px'}} onClick={e => e.stopPropagation()}>
               {!isForceUsername && <FiX className="close-modal" onClick={() => setShowProfileSettings(false)} />}
               
               <div className="settings-profile" style={{textAlign: 'center', marginBottom: '25px'}}>
                  <div style={{position: 'relative', display: 'inline-block'}}>
                    <img 
                      src={editAvatarUrl ? `${SERVER_URL}${editAvatarUrl}` : `https://ui-avatars.com/api/?name=${editFullName}&background=22272E&color=fff`} 
                      alt="Me" 
                      className="avatar" 
                      style={{width: '90px', height: '90px', borderRadius:'50%', border:'3px solid var(--primary-blue)', marginBottom: '10px'}} 
                    />
                    <label htmlFor="avatar-upload" style={{position: 'absolute', bottom: '15px', right: '0', background: 'var(--primary-blue)', borderRadius: '50%', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.5)'}}>
                      <FiEdit2 size={14} color="#fff" />
                    </label>
                    <input type="file" id="avatar-upload" style={{display: 'none'}} onChange={handleAvatarUpdate} />
                  </div>
                  <h2 style={{margin:'0 0 5px', fontSize:'22px'}}>{isForceUsername ? 'Complete Your Profile' : 'Edit Profile'}</h2>
                  <p style={{margin:0, color:'var(--text-muted)', fontSize: '14px'}}>{userInfo.email}</p>
               </div>

               <div className="profile-form">
                 <div className="form-group" style={{marginBottom: '15px'}}>
                   <label style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', display: 'block'}}>FULL NAME</label>
                   <input 
                     type="text" 
                     className="form-input" 
                     style={{background: 'var(--bg-dark)', padding: '10px'}}
                     value={editFullName}
                     onChange={e => setEditFullName(e.target.value)}
                   />
                 </div>
                 <div className="form-group" style={{marginBottom: '15px'}}>
                   <label style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', display: 'block'}}>USERNAME</label>
                   <div style={{position: 'relative'}}>
                     <span style={{position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)'}}>@</span>
                     <input 
                       type="text" 
                       className="form-input" 
                       style={{background: 'var(--bg-dark)', padding: '10px 10px 10px 25px'}}
                       value={editUsername}
                       onChange={e => setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                       placeholder="your_unique_username"
                     />
                   </div>
                 </div>
                 <div className="form-group" style={{marginBottom: '20px'}}>
                   <label style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', display: 'block'}}>BIO</label>
                   <textarea 
                     className="form-input" 
                     style={{background: 'var(--bg-dark)', padding: '10px', minHeight: '80px', resize: 'none'}}
                     value={editBio}
                     onChange={e => setEditBio(e.target.value)}
                     placeholder="Tell the workspace a bit about yourself..."
                   />
                 </div>

                 <div style={{display: 'flex', gap: '10px'}}>
                   <button className="btn-primary" style={{flex: 1}} onClick={handleUpdateProfile}>Save Changes</button>
                   {!isForceUsername && <button className="btn-danger" style={{padding: '10px 15px'}} onClick={handleLogout} title="Logout"><FiLogOut/></button>}
                 </div>
               </div>
            </div>
         </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
         <div className="modal-overlay" onClick={(e) => { if(e.target === e.currentTarget) setShowCreateModal(false); }}>
            <div className="settings-modal" style={{width: '450px'}} onClick={e => e.stopPropagation()}>
               <FiX className="close-modal" onClick={() => setShowCreateModal(false)} />
               <h2 style={{marginBottom: '20px'}}>Create a Room</h2>
               
               <form onSubmit={handleCreateRoomSubmit}>
                 <div className="form-group">
                   <label>Room Name</label>
                   <input type="text" className="form-input" style={{background:'var(--bg-surface)'}} value={newRoomName} onChange={e => setNewRoomName(e.target.value)} required placeholder="e.g. Marketing Campaign" />
                 </div>
                 
                 <div className="form-group checkbox-container" style={{display:'flex', alignItems:'center', gap:'10px', marginTop:'15px', color:'var(--text-secondary)'}}>
                   <input 
                     type="checkbox" 
                     id="privateToggle"
                     checked={newRoomIsPrivate}
                     onChange={e => setNewRoomIsPrivate(e.target.checked)}
                     style={{width:'18px', height:'18px', accentColor:'var(--primary-blue)'}}
                   />
                   <label htmlFor="privateToggle" style={{margin:0, cursor:'pointer'}}>Make this room Private (Invite Only)</label>
                 </div>

                 {newRoomIsPrivate && (
                   <div className="form-group" style={{marginTop:'15px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                        <label style={{margin: 0}}>Invite Members</label>
                        <div className="search-input-wrap" style={{width: '200px'}}>
                          <FiSearch className="search-icon" style={{fontSize: '12px'}} />
                          <input 
                            type="text" 
                            placeholder="Search members..." 
                            value={createRoomSearchQuery}
                            onChange={e => setCreateRoomSearchQuery(e.target.value)}
                            style={{width: '100%', padding: '6px 6px 6px 28px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px'}}
                          />
                        </div>
                      </div>
                     <div className="form-group checkbox-list">
                       {users.filter(u => u.fullName.toLowerCase().includes(createRoomSearchQuery.toLowerCase())).map(u => (
                         <div className="checkbox-item" key={u._id} onClick={() => toggleMemberSelection(u._id)}>
                           <input type="checkbox" checked={newRoomMembers.includes(u._id)} readOnly style={{accentColor:'var(--primary-blue)'}} />
                          <img src={getAvatarUrl(u)} alt={u.fullName} />
                           <span style={{color:'var(--text-secondary)', fontSize:'13px'}}>{u.fullName}</span>
                         </div>
                       ))}
                       {users.length === 0 && <span style={{fontSize:'12px', color:'var(--text-muted)'}}>No users available to invite.</span>}
                       {users.length > 0 && users.filter(u => u.fullName.toLowerCase().includes(createRoomSearchQuery.toLowerCase())).length === 0 && (
                          <span style={{fontSize:'12px', color:'var(--text-muted)', display:'block', padding:'10px'}}>No members found matching your search.</span>
                       )}
                     </div>
                   </div>
                 )}

                 <div style={{display:'flex', gap:'10px', marginTop:'25px'}}>
                    <button type="button" className="btn-secondary" style={{flex:1}} onClick={() => setShowCreateModal(false)}>Cancel</button>
                    <button type="submit" className="btn-message" style={{flex:1}}>Create Room</button>
                 </div>
               </form>
            </div>
         </div>
      )}

      {/* Room Settings Modal */}
      {showRoomSettings && activeRoom && (
         <div className="modal-overlay" onClick={(e) => { if(e.target === e.currentTarget) setShowRoomSettings(false); }}>
            <div className="settings-modal" style={{width: '500px'}} onClick={e => e.stopPropagation()}>
               <FiX className="close-modal" onClick={() => setShowRoomSettings(false)} />
               <h2 style={{marginBottom: '5px'}}>Room Settings</h2>
               <p style={{color:'var(--text-muted)', fontSize:'13px', marginBottom:'20px'}}>Manage details and members for {getPrivateRoomName(activeRoom)}</p>
               
               {/* RENAME ROOM (Visible to Admiss & Owner) */}
               {(isRoomOwner || isRoomAdmin) ? (
                 <div className="form-group">
                   <label>Rename Room</label>
                   <div style={{display:'flex', gap:'10px'}}>
                     <input type="text" className="form-input" style={{background:'var(--bg-surface)'}} value={editingRoomName} onChange={e => setEditingRoomName(e.target.value)} />
                     <button className="btn-message" style={{width:'auto'}} onClick={handleRenameRoom}>Save Name</button>
                   </div>
                 </div>
               ) : (
                  <p style={{fontSize:'13px', color:'var(--yellow-away)', background:'rgba(251, 191, 36, 0.1)', padding:'10px', borderRadius:'6px'}}>
                    <FiShield style={{marginRight:'5px'}}/> Only Owners and Admins can edit this room.
                  </p>
               )}
               
               {/* MEMBER ROLES (Visible to all, editable by Owner) */}
               <div className="form-group" style={{marginTop:'25px'}}>
                 <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                    <label style={{margin: 0}}>Room Members ({activeRoom.members?.length || 0})</label>
                    <div className="search-input-wrap" style={{width: '200px'}}>
                        <FiSearch className="search-icon" style={{fontSize: '12px'}} />
                        <input 
                          type="text" 
                          placeholder="Search members..." 
                          value={roomMemberSearchQuery}
                          onChange={e => setRoomMemberSearchQuery(e.target.value)}
                          style={{width: '100%', padding: '6px 6px 6px 28px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px'}}
                        />
                    </div>
                 </div>
                 <div className="form-group checkbox-list" style={{maxHeight:'200px'}}>
                   {activeRoom.members?.filter(m => m.fullName.toLowerCase().includes(roomMemberSearchQuery.toLowerCase())).map(member => {
                      const isMemberOwner = activeRoom.owner === member._id;
                      const isMemberAdmin = activeRoom.admins?.includes(member._id);
                      
                      return (
                       <div className="checkbox-item" key={member._id} style={{cursor:'default'}}>
                         <img src={getAvatarUrl(member)} alt={member.fullName} />
                         <span style={{color:'var(--text-primary)', fontSize:'14px', fontWeight:500}}>
                            {member.fullName} {member._id === userInfo._id && '(You)'}
                         </span>
                         
                         {isMemberOwner ? (
                             <span className="role-badge owner">Owner</span>
                         ) : isMemberAdmin ? (
                             <span className="role-badge">Admin</span>
                         ) : (
                            <span className="role-badge" style={{background:'transparent', color:'var(--text-muted)'}}>Member</span>
                         )}

                         {/* Admin Controls (Only owner can promote/demote) */}
                         {isRoomOwner && !isMemberOwner && (
                            <div style={{marginLeft:'auto'}}>
                               {isMemberAdmin ? (
                                  <button onClick={() => handleManageRole(member._id, 'remove')} style={{background:'transparent', border:'1px solid var(--border-color)', color:'var(--text-secondary)', padding:'4px 8px', borderRadius:'4px', fontSize:'11px', cursor:'pointer'}}>Demote</button>
                               ) : (
                                  <button onClick={() => handleManageRole(member._id, 'add')} style={{background:'transparent', border:'1px solid var(--primary-blue)', color:'var(--primary-blue)', padding:'4px 8px', borderRadius:'4px', fontSize:'11px', cursor:'pointer'}}>Make Admin</button>
                               )}
                            </div>
                         )}
                       </div>
                     )})}
                 </div>
               </div>

               {/* DELETE ROOM (Owner Only) */}
               {isRoomOwner && (
                 <div style={{marginTop:'30px', borderTop:'1px solid var(--border-color)', paddingTop:'20px'}}>
                    <h3 style={{fontSize:'16px', color:'#ef4444', marginBottom:'10px', display:'flex', alignItems:'center', gap:'8px'}}>
                       <FiTrash2 /> Danger Zone
                    </h3>
                    <button className="btn-danger" onClick={handleDeleteRoom}>Delete Room</button>
                 </div>
               )}

            </div>
         </div>
      )}

      {/* Forward Message Modal */}
      {showForwardModal && messageToForward && (
         <div className="modal-overlay" onClick={(e) => { if(e.target === e.currentTarget) setShowForwardModal(false); }}>
            <div className="settings-modal" style={{width: '400px'}} onClick={e => e.stopPropagation()}>
               <FiX className="close-modal" onClick={() => setShowForwardModal(false)} />
               <h2 style={{marginBottom: '10px'}}>Forward Message</h2>
               <p style={{color:'var(--text-muted)', fontSize:'13px', marginBottom:'20px'}}>Select a channel or direct message to forward this to.</p>
               
               <div className="room-list" style={{maxHeight:'300px', overflowY:'auto'}}>
                  {rooms.map(room => (
                    <div 
                      key={room._id}
                      className="room-item"
                      style={{padding: '12px', cursor:'pointer', borderBottom: '1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'center'}}
                      onClick={() => handleForwardMessage(room._id)}
                    >
                      <span>
                        {room.type === 'public' ? '# ' : '@ '}
                        {getPrivateRoomName(room)}
                      </span>
                      <button className="btn-message" style={{width:'auto', padding:'4px 10px', fontSize:'12px'}}>Forward</button>
                    </div>
                  ))}
               </div>
            </div>
         </div>
      )}

      {/* User Profile View Modal (For others) */}
      {showUserProfile && viewingUser && (
         <div className="modal-overlay" onClick={(e) => { if(e.target === e.currentTarget) setShowUserProfile(false); }}>
            <div className="settings-modal" style={{width: '400px'}} onClick={e => e.stopPropagation()}>
               <FiX className="close-modal" onClick={() => setShowUserProfile(false)} />
               
               <div className="settings-profile" style={{textAlign: 'center', marginBottom: '20px'}}>
                  <img 
                    src={getAvatarUrl(viewingUser)} 
                    alt={viewingUser.fullName} 
                    className="avatar" 
                    style={{width: '100px', height: '100px', borderRadius:'50%', border:'3px solid var(--primary-blue)', marginBottom: '15px'}} 
                  />
                  <h2 style={{margin:'0 0 5px', fontSize:'24px'}}>{viewingUser.fullName}</h2>
                  <p style={{margin:0, color:'var(--primary-blue)', fontWeight: 600}}>@{viewingUser.username || 'user'}</p>
               </div>

               <div className="profile-details" style={{background: 'var(--bg-dark)', padding: '20px', borderRadius: '12px', marginBottom: '20px'}}>
                  <h4 style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px'}}>About</h4>
                  <p style={{margin: 0, lineHeight: '1.6', color: 'var(--text-primary)'}}>
                    {viewingUser.bio || "No bio yet. This user is keeping it a mystery!"}
                  </p>
               </div>

               <div className="user-profile-actions" style={{display: 'flex', gap: '10px'}}>
                  <button className="btn-primary" style={{flex: 1}} onClick={() => startDirectMessage(viewingUser)}>
                    Message
                  </button>
                  <button 
                    className={`btn-secondary ${userInfo?.contacts?.includes(viewingUser._id) ? 'active' : ''}`}
                    style={{flex: 1, background: userInfo?.contacts?.includes(viewingUser._id) ? 'var(--primary-blue)' : 'transparent', border: '1px solid var(--border-color)'}}
                    onClick={() => handleToggleContact(viewingUser._id)}
                  >
                    {userInfo?.contacts?.includes(viewingUser._id) ? 'Following' : 'Follow'}
                  </button>
                </div>
            </div>
         </div>
      )}

      {/* Toast Notification Layer */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
             <div className="toast-icon">
                {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
             </div>
             {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatApp;
