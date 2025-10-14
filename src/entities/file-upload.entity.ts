import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Organization } from './organization.entity';

@Entity('file_uploads')
export class FileUpload {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column()
  localPath: string;

  @Column({ nullable: true })
  externalPath: string;

  @Column()
  originalName: string;

  @Column()
  fileSize: number;

  @Column()
  mimeType: string;

  @Column({ default: false })
  isProcessed: boolean;

  @Column({ nullable: true })
  conversationId?: string;

  @Column({ nullable: true })
  messageId?: string;

 
  @Column({ nullable: true })
  organizationId: string; // Which organization this file belongs to

  @ManyToOne(() => User, user => user.id, { nullable: true ,eager: true})
  user: User;

  @ManyToOne(() => Organization, organization => organization.id, { nullable: true ,eager: true})
  organization: Organization;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
