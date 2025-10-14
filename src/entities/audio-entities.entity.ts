import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { AudioFile } from './audio-file.entity';

@Entity('audio_entities')
export class AudioEntities {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  accountId: string;

  @Column({ nullable: true })
  orderId: string;

  @Column({ nullable: true })
  product: string;

  @Column({ unique: true })
  audioId: string;

  @OneToOne(() => AudioFile, audioFile => audioFile.audioEntity)
  @JoinColumn({ name: 'audioId' })
  audio: AudioFile;
}
