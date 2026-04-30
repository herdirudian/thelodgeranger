CREATE TABLE `VoteCandidateMedia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoryId` INTEGER NOT NULL,
    `candidateUserId` INTEGER NOT NULL,
    `photoUrl` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VoteCandidateMedia_categoryId_candidateUserId_key`(`categoryId`, `candidateUserId`),
    INDEX `VoteCandidateMedia_candidateUserId_idx`(`candidateUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `VoteCandidateMedia` ADD CONSTRAINT `VoteCandidateMedia_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `VotingCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `VoteCandidateMedia` ADD CONSTRAINT `VoteCandidateMedia_candidateUserId_fkey` FOREIGN KEY (`candidateUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

