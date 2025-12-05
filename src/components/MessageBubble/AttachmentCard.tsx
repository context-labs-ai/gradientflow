import React from 'react';
import { FileText, FileCode, FileJson, File, Database, ExternalLink } from 'lucide-react';
import { Message } from '../../types/chat';
import './styles.css';

interface Attachment {
    filename: string;
    size?: number;
    type?: string;
    uploadedToRag?: boolean;
    chunksCreated?: number;
    documentId?: string;
}

interface AttachmentCardProps {
    message: Message;
    isOwnMessage: boolean;
}

const FILE_ICONS: Record<string, React.ReactNode> = {
    md: <FileText size={18} />,
    txt: <FileText size={18} />,
    json: <FileJson size={18} />,
    js: <FileCode size={18} />,
    ts: <FileCode size={18} />,
    tsx: <FileCode size={18} />,
    jsx: <FileCode size={18} />,
    py: <FileCode size={18} />,
    java: <FileCode size={18} />,
    c: <FileCode size={18} />,
    cpp: <FileCode size={18} />,
    go: <FileCode size={18} />,
    rs: <FileCode size={18} />,
    html: <FileCode size={18} />,
    css: <FileCode size={18} />,
    xml: <FileCode size={18} />,
    csv: <FileText size={18} />,
};

function getFileIcon(type?: string): React.ReactNode {
    if (!type) return <File size={18} />;
    return FILE_ICONS[type.toLowerCase()] || <File size={18} />;
}

function formatFileSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'FILE';
}

export const AttachmentCard: React.FC<AttachmentCardProps> = ({ message, isOwnMessage }) => {
    const attachment = message.metadata?.attachment as Attachment | undefined;

    if (!attachment?.filename) return null;

    const ext = getFileExtension(attachment.filename);
    const sizeText = formatFileSize(attachment.size);

    return (
        <div className={`attachment-card ${isOwnMessage ? 'own' : 'other'}`}>
            <div className="attachment-icon-wrapper">
                {getFileIcon(attachment.type)}
                <span className="attachment-ext">{ext}</span>
            </div>
            <div className="attachment-info">
                <span className="attachment-filename" title={attachment.filename}>
                    {attachment.filename}
                </span>
                <div className="attachment-meta">
                    {sizeText && <span className="attachment-size">{sizeText}</span>}
                    {attachment.uploadedToRag && (
                        <span className="attachment-rag-badge" title={`已添加到知识库 (${attachment.chunksCreated || 0} 个文本块)`}>
                            <Database size={10} />
                            <span>知识库</span>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * Remove attachment text indicators from message content.
 * Matches patterns like: 📎 [附件: filename.ext] or 📎 [附件: filename.ext] (已添加到知识库)
 */
export function stripAttachmentText(content: string): string {
    // Remove attachment indicator lines
    return content
        .replace(/📎\s*\[附件:\s*[^\]]+\]\s*(\([^)]*\))?\s*/g, '')
        .trim();
}
