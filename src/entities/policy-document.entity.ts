import { PolicyDocumentParentId, PolicyDocumentType } from '../utils/types';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Organization } from './organization.entity';
@Entity('policy_documents')
export class PolicyDocument {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: PolicyDocumentType
  })
  type: PolicyDocumentType;

  @Column({
    type: 'enum',
    enum: PolicyDocumentParentId,
    nullable: true
  })
  parentId?: PolicyDocumentParentId;

  @Column()
  fileName: string;

  @Column()
  filePath: string;

  @Column()
  fileSize: number;

  @Column()
  mimeType: string; // e.g. "application/pdf"

  @Column({ nullable: true })
  uploadedBy?: string;

  @Column('json', { nullable: true })
  headers?: any; // Document headers/metadata

  @Column({ default: false })
  isProcessed: boolean;

  @Column({ nullable: true })
  version?: string;

  @Column({ nullable: true })
  effectiveDate?: Date;


  @ManyToOne(() => Organization, organization => organization.id, { nullable: true ,eager: true})
  organization: Organization;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
