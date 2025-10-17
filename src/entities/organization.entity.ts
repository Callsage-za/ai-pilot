import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Conversation } from './conversation.entity';
import { Document } from './document.entity';
import { AudioFile } from './audio-file.entity';
import { FileUpload } from './file-upload.entity';
import { JiraCredentials } from './jira-credentials.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  domain: string; // e.g., "company.com" for email domain validation

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => User, user => user.organization)
  users: User[];

  @OneToMany(() => Conversation, conversation => conversation.organization)
  conversations: Conversation[];

  @OneToMany(() => Document, document => document.organization)
  documents: Document[];

  @OneToMany(() => AudioFile, audioFile => audioFile.organization)
  audioFiles: AudioFile[];

  @OneToMany(() => FileUpload, fileUpload => fileUpload.organization)
  fileUploads: FileUpload[];

  @OneToMany(() => JiraCredentials, jiraCredentials => jiraCredentials.organization)
  jiraCredentials: JiraCredentials[];
}
