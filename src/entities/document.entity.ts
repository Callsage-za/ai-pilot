import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';
import { Organization } from './organization.entity';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string; 

  @Column({ nullable: true })
  description: string;

  @Column()
  category: string; // e.g. "policies", "hr", "sales"

  @Column({ nullable: true })
  subsection: string; // e.g. "company-policies", "onboarding"

  @Column()
  fileName: string;

  @Column()
  filePath: string;

  @Column()
  fileSize: number;

  @Column()
  mimeType: string; // e.g. "application/pdf"

  @Column({ nullable: true })
  uploadedBy: string;

  @Column({ nullable: true })
  userId: string; // Who uploaded this document

  @Column({ nullable: true })
  organizationId: string; // Which organization this document belongs to

  @Column('json', { nullable: true })
  headers: any; // Document headers/metadata

  @Column({ default: false })
  isProcessed: boolean;

  @ManyToOne(() => User, user => user.documents)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Organization, organization => organization.documents)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
