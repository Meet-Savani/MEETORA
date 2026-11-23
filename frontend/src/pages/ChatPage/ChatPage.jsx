import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { Send, Image, Message, ChevronRight, ArrowBack, Add, Description, Movie, Close, Delete as DeleteIcon } from '@mui/icons-material';
import Loader from '../../components/Loader/Loader';
import { setToast } from '../../redux/state';
import '../../styles/Chat.scss';
import { apiFetch, apiPost, apiDelete } from '../../utils/api';
import { fileToBase64 } from '../../utils/fileToBase64';
import { BACKEND_BASE_URL } from '../../config/constants';
import { resolveImageUrl } from '../../utils/image';
import ConfirmationModal from '../../components/ConfirmationModal/ConfirmationModal';

const ChatPage = () => {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.user.user);
  const userId = user?._id;
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(true);
  const [inbox, setInbox] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);

  // Message input and attachment states
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [fileType, setFileType] = useState(null); // 'image', 'video', 'document'
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [acceptType, setAcceptType] = useState('*');
  const [isClosing, setIsClosing] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);

  const fileInputRef = useRef(null);
  const messagesLogRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const prevActiveContactIdRef = useRef(null);
  const attachmentMenuRef = useRef(null);

  // Close attachment dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(e.target)) {
        setAttachmentMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const getInbox = async () => {
    if (!userId) return;
    try {
      const response = await apiFetch(`/messages/inbox/${userId}`);
      const data = await response.json();
      if (response.ok) {
        setInbox(data.inbox || []);
      }
    } catch (err) {
      console.error("Error fetching inbox contacts:", err);
    }
  };

  const getThread = async (contactId) => {
    if (!userId || !contactId) return;
    try {
      const response = await apiFetch(`/messages/thread/${userId}/${contactId}`);
      const data = await response.json();
      if (response.ok) {
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Error fetching thread messages:", err);
    }
  };

  // Initial load of inbox list
  useEffect(() => {
    if (userId) {
      getInbox().then(() => setLoading(false));
    }
  }, [userId]);

  // Handle URL contact selection and details fetching
  useEffect(() => {
    if (contactId) {
      const found = inbox.find(({ partner }) => partner._id === contactId);
      if (found) {
        setActiveContact(found.partner);
      } else {
        const fetchContact = async () => {
          try {
            const res = await apiFetch(`/users/${contactId}`);
            const data = await res.json();
            if (res.ok && data.user) {
              setActiveContact(data.user);
            } else {
              setActiveContact({ _id: contactId, firstName: 'Owner', lastName: '' });
            }
          } catch (err) {
            console.error("Error fetching contact info:", err);
            setActiveContact({ _id: contactId, firstName: 'Owner', lastName: '' });
          }
        };
        fetchContact();
      }
    } else {
      setActiveContact(null);
    }
  }, [contactId, inbox]);

  // Active Contact Polling
  useEffect(() => {
    let interval;
    if (activeContact) {
      getThread(activeContact._id);
      interval = setInterval(() => {
        getThread(activeContact._id);
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeContact]);

  // Smart Auto-Scroll to bottom
  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesLogRef.current) {
      messagesLogRef.current.scrollTo({
        top: messagesLogRef.current.scrollHeight,
        behavior
      });
    }
  };

  const isNearBottom = () => {
    if (!messagesLogRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = messagesLogRef.current;
    return scrollHeight - scrollTop - clientHeight < 150;
  };

  useEffect(() => {
    if (!activeContact || messages.length === 0) return;

    const prevLength = prevMessagesLengthRef.current;
    const currentLength = messages.length;
    const contactChanged = prevActiveContactIdRef.current !== activeContact._id;

    if (contactChanged) {
      scrollToBottom('smooth');
      prevActiveContactIdRef.current = activeContact._id;
    } else if (currentLength > prevLength) {
      const lastMessage = messages[currentLength - 1];
      const isMyMessage = lastMessage.senderId?._id?.toString() === userId || lastMessage.senderId?.toString() === userId;

      if (isMyMessage || isNearBottom()) {
        scrollToBottom('smooth');
      }
    }

    prevMessagesLengthRef.current = currentLength;
  }, [messages, activeContact]);

  const handleSelectContact = (contact) => {
    navigate(`/chat/${contact._id}`);
  };

  const handleBackToInbox = () => {
    setActiveContact(null);
    navigate('/chat');
  };

  const handleCloseChat = () => {
    setIsClosing(true);
    setTimeout(() => {
      setActiveContact(null);
      setIsClosing(false);
      navigate('/chat');
    }, 300);
  };

  const triggerDeleteChat = (contact, e) => {
    if (e) e.stopPropagation();
    setContactToDelete(contact);
    setDeleteModalOpen(true);
  };

  const handleConfirmDeleteChat = async () => {
    if (!userId || !contactToDelete) return;
    try {
      const res = await apiDelete(`/messages/thread/${userId}/${contactToDelete._id}`);
      if (res.ok) {
        dispatch(setToast({ message: "Conversation deleted successfully.", type: "success" }));
        
        // Remove from local inbox state immediately
        setInbox(prevInbox => prevInbox.filter(({ partner }) => partner._id !== contactToDelete._id));
        
        // If the deleted conversation is the active one, close it
        if (activeContact && activeContact._id === contactToDelete._id) {
          setActiveContact(null);
          setMessages([]);
          navigate('/chat');
        }
      } else {
        dispatch(setToast({ message: "Failed to delete conversation.", type: "error" }));
      }
    } catch (err) {
      console.error(err);
      dispatch(setToast({ message: "Error deleting conversation.", type: "error" }));
    } finally {
      setDeleteModalOpen(false);
      setContactToDelete(null);
    }
  };

  // File type detection and size validation
  const getFileType = (file) => {
    if (!file) return null;
    const type = file.type;
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        return 'image';
    }
    if (type.startsWith('video/') || ['mp4', 'mov', 'webm', 'avi'].includes(ext)) {
        return 'video';
    }
    const docExts = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'zip'];
    if (docExts.includes(ext) || type.startsWith('application/') || type.startsWith('text/')) {
        return 'document';
    }
    return null;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
    if (file.size > MAX_FILE_SIZE) {
      dispatch(setToast({ message: "File size exceeds the 25MB limit.", type: "error" }));
      return;
    }

    const detectedType = getFileType(file);
    if (!detectedType) {
      dispatch(setToast({ message: "Unsupported file type. Please upload images, videos, or documents (PDF, Word, Excel, PPT, Text, Zip).", type: "error" }));
      return;
    }

    setSelectedFile(file);
    setFileType(detectedType);
    setFilePreview(URL.createObjectURL(file));
  };

  const handleAttachmentClick = (type) => {
    let accept = '*';
    if (type === 'image') accept = 'image/*';
    else if (type === 'video') accept = 'video/*';
    else if (type === 'document') accept = '.pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.zip';
    
    setAcceptType(accept);
    setAttachmentMenuOpen(false);
    
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 50);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!(text || "").trim() && !selectedFile) return;

    setSending(true);
    setUploadProgress(0);

    try {
      let imageBase64 = null;
      if (selectedFile) {
        imageBase64 = await fileToBase64(selectedFile);
      }

      const payload = {
        receiverId: activeContact._id,
        text,
        image: imageBase64,
        fileName: selectedFile ? selectedFile.name : "",
        fileType: fileType || ""
      };

      const response = await apiPost('/messages/create', payload);

      if (response.ok) {
        setText("");
        setSelectedFile(null);
        setFilePreview("");
        setFileType(null);
        setUploadProgress(0);
        getThread(activeContact._id);
        getInbox();
      } else {
        dispatch(setToast({ message: "Failed to send message.", type: "error" }));
      }
    } catch (err) {
      console.error(err);
      dispatch(setToast({ message: "Error sending message.", type: "error" }));
    } finally {
      setSending(false);
    }
  };

  const removeAttachedFile = () => {
    setSelectedFile(null);
    setFilePreview("");
    setFileType(null);
  };

  // Online status helper
  const renderOnlineStatus = (contact) => {
    if (!contact || !contact.lastActive) {
      return <span className="online-status offline">Offline</span>;
    }

    const lastActiveDate = new Date(contact.lastActive);
    const diffMs = Date.now() - lastActiveDate.getTime();
    
    if (diffMs < 25000) {
      return <span className="online-status online">🟢 Online</span>;
    }

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let lastSeenText = '';
    if (diffMins < 1) {
      lastSeenText = 'Just now';
    } else if (diffMins < 60) {
      lastSeenText = `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      lastSeenText = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays === 1) {
      lastSeenText = 'Yesterday';
    } else {
      lastSeenText = `${diffDays} days ago`;
    }

    return <span className="online-status offline">Last seen: {lastSeenText}</span>;
  };

  return loading ? <Loader /> : (
    <div className="chat-page">
      <div className={`chat-container ${activeContact ? 'has-active-contact' : ''}`}>
        
        {/* Inbox Left Sidebar Panel */}
        <div className="inbox-sidebar">
          <div className="sidebar-header">
            <h2>Messages</h2>
          </div>
          <div className="contacts-list">
            {inbox.length > 0 ? (
              inbox.map(({ partner, lastMessage }) => {
                const avatar = resolveImageUrl(partner.profileImagePath, "/assets/default.jpg");
                
                const isActive = activeContact?._id === partner._id;

                return (
                  <div 
                    key={partner._id} 
                    className={`contact-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectContact(partner)}>
                    <img src={avatar} alt={partner.firstName} className="avatar" />
                    <div className="contact-meta">
                      <div className="contact-name-row">
                        <h4>{partner.firstName} {partner.lastName}</h4>
                      </div>
                      <p className="last-message">
                        {lastMessage?.fileType === "image" && "📷 Photo"}
                        {lastMessage?.fileType === "video" && "🎥 Video"}
                        {lastMessage?.fileType === "document" && "📄 Document"}
                        {(!lastMessage?.fileType && lastMessage?.imagePath) && "📷 Photo"}
                        {!lastMessage?.fileType && !lastMessage?.imagePath && lastMessage?.text}
                      </p>
                    </div>
                    <ChevronRight className="arrow-icon" />
                  </div>
                );
              })
            ) : (
              <div className="empty-inbox">
                <Message className="empty-icon" />
                <p>No chats yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Chat Thread Panel */}
        <div className={`chat-thread-panel ${isClosing ? 'closing' : ''}`}>
          {activeContact ? (
            <>
              {/* Contact Header */}
              <div className="thread-header">
                <button className="back-btn" onClick={handleBackToInbox}>
                  <ArrowBack />
                </button>
                <img 
                  src={resolveImageUrl(activeContact.profileImagePath, "/assets/default.jpg")} 
                  alt={activeContact.firstName} 
                  className="avatar" 
                  onError={(e) => { e.target.onerror = null; e.target.src = "/assets/default.jpg"; }}
                />
                <div className="header-info">
                  <h3>{activeContact.firstName} {activeContact.lastName}</h3>
                  {renderOnlineStatus(activeContact)}
                </div>
                <button className="delete-chat-btn" onClick={() => triggerDeleteChat(activeContact)} title="Delete Conversation">
                  <DeleteIcon />
                </button>
                <button className="close-chat-btn" onClick={handleCloseChat} title="Close Conversation">
                  <Close />
                </button>
              </div>

              {/* Message Log */}
              <div className="messages-log" ref={messagesLogRef}>
                {messages.map((msg) => {
                  const isMe = (msg.senderId?._id || msg.senderId)?.toString() === userId;
                  const isImage = msg.fileType === "image" || (!msg.fileType && msg.imagePath);
                  const isVideo = msg.fileType === "video";
                  const isDoc = msg.fileType === "document";

                  return (
                    <div key={msg._id} className={`message-bubble-wrapper ${isMe ? 'outgoing' : 'incoming'}`}>
                      <div className="message-bubble">
                        
                        {/* Render Images */}
                        {isImage && msg.imagePath && (
                          <img 
                            src={resolveImageUrl(msg.imagePath)} 
                            alt="attachment" 
                            className="msg-attached-image" 
                            onClick={() => window.open(resolveImageUrl(msg.imagePath), '_blank')}
                          />
                        )}

                        {/* Render Videos */}
                        {isVideo && msg.imagePath && (
                          <video 
                            src={resolveImageUrl(msg.imagePath)} 
                            controls 
                            className="msg-attached-video" 
                          />
                        )}

                        {/* Render Documents */}
                        {isDoc && msg.imagePath && (
                          <div className="msg-attached-document">
                            <Description className="doc-icon" />
                            <div className="doc-meta">
                              <span className="doc-name">{msg.fileName || "Document"}</span>
                              <a 
                                href={resolveImageUrl(msg.imagePath)} 
                                download={msg.fileName}
                                target="_blank" 
                                rel="noreferrer"
                                className="doc-download-btn"
                              >
                                Download
                              </a>
                            </div>
                          </div>
                        )}

                        {msg.text && <p className="msg-text">{msg.text}</p>}
                        <span className="msg-time">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress bar for uploads */}
              {sending && uploadProgress > 0 && (
                <div className="upload-progress-container">
                  <div className="progress-bar" style={{ width: `${uploadProgress}%` }}>
                    <span className="progress-text">Uploading attachment {uploadProgress}%</span>
                  </div>
                </div>
              )}

              {/* Preview file attachment input */}
              {filePreview && (
                <div className="attachment-preview-strip">
                  <div className="preview-container">
                    {fileType === 'image' && <img src={filePreview} alt="upload preview" />}
                    {fileType === 'video' && (
                      <div className="video-preview-box">
                        <Movie className="preview-icon" />
                        <span className="preview-name">{selectedFile.name}</span>
                      </div>
                    )}
                    {fileType === 'document' && (
                      <div className="doc-preview-box">
                        <Description className="preview-icon" />
                        <span className="preview-name">{selectedFile.name}</span>
                      </div>
                    )}
                    <button className="remove-preview-btn" onClick={removeAttachedFile}>
                      <Close />
                    </button>
                  </div>
                </div>
              )}

              {/* Message Entry controls */}
              <form className="message-entry-form" onSubmit={handleSendMessage}>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept={acceptType}
                  onChange={handleFileChange}
                />
                
                {/* Plus (+) Button for Attachment Menu */}
                <div className="attachment-menu-container" ref={attachmentMenuRef}>
                  <button 
                    type="button" 
                    className={`attach-file-btn ${attachmentMenuOpen ? 'active' : ''}`}
                    onClick={() => setAttachmentMenuOpen(!attachmentMenuOpen)}
                  >
                    <Add />
                  </button>
                  
                  {attachmentMenuOpen && (
                    <div className="attachment-dropdown-menu">
                      <button type="button" onClick={() => handleAttachmentClick('image')}>
                        <Image className="menu-icon" /> Image
                      </button>
                      <button type="button" onClick={() => handleAttachmentClick('video')}>
                        <Movie className="menu-icon" /> Video
                      </button>
                      <button type="button" onClick={() => handleAttachmentClick('document')}>
                        <Description className="menu-icon" /> Document
                      </button>
                    </div>
                  )}
                </div>

                <input 
                  type="text" 
                  placeholder="Type message here..." 
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button type="submit" className="send-message-btn" disabled={sending || (!(text || "").trim() && !selectedFile)}>
                  <Send />
                </button>
              </form>
            </>
          ) : (
            <div className="no-chat-selected">
              <Message className="placeholder-icon" />
              <h2>Your Inbox</h2>
              <p>Select a message thread on the left panel to begin communication.</p>
            </div>
          )}
        </div>
      </div>
      <ConfirmationModal
        open={deleteModalOpen}
        title="Delete Conversation"
        message="Are you sure you want to delete this conversation? This action cannot be undone."
        type="confirm"
        onConfirm={handleConfirmDeleteChat}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
};

export default ChatPage;
