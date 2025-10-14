import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { Organization } from './organization.entity';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { Document } from './document.entity';
import { AudioFile } from './audio-file.entity';
import { FileUpload } from './file-upload.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string; // Will be hashed

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: 'user' })
  role: string; // 'admin', 'user', 'manager', etc.

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column()
  organizationId: string;

  @ManyToOne(() => Organization, organization => organization.users)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @OneToMany(() => Conversation, conversation => conversation.user)
  conversations: Conversation[];

  @OneToMany(() => Message, message => message.user)
  messages: Message[];

  @OneToMany(() => Document, document => document.user)
  documents: Document[];

  @OneToMany(() => AudioFile, audioFile => audioFile.user)
  audioFiles: AudioFile[];

  @OneToMany(() => FileUpload, fileUpload => fileUpload.user)
  fileUploads: FileUpload[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
