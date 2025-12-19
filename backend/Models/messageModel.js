import mongoose from "mongoose"

const messageSchema = new mongoose.Schema({
    conversationId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Conversation"
    },
    sender:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"

    },
    text:String,
    seen:{
        type:Boolean,
        default:false
    },
    img:{
        type:String,
        default:""
    },
    video:{
        type:String,
        default:""
    },
    fileUrl:{
        type:String,
        default:""
    },
    fileName:{
        type:String,
        default:""
    },
    fileType:{
        type:String,
        default:"" // pdf, doc, docx, etc.
    },
    audio:{
        type:String,
        default:"" // audio file URL
    },
    // WhatsApp-style delete fields
    deletedForUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    deletedForAll: {
        type: Boolean,
        default: false
    },
    deletedForAllAt: {
        type: Date,
        default: null
    }
},{timestamps:true})


const Message = mongoose.model("Message",messageSchema)

export default Message;