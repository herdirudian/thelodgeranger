const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Self Assessment Module...');

  const questions = [
    // ATTITUDE (Sikap)
    {
      question: "Ceritakan situasi terakhir di mana kamu merasa tertekan atau berada dalam situasi yang menantang di tempat kerja. Bagaimana kamu menghadapinya, dan apa yang kamu pelajari dari pengalaman tersebut?",
      type: "ESSAY",
      category: "ATTITUDE (Sikap)"
    },
    {
      question: "Bagaimana kamu menjaga hubungan yang baik dengan rekan kerja, atasan, dan pihak lainnya, terutama di situasi yang penuh tekanan atau konflik?",
      type: "ESSAY",
      category: "ATTITUDE (Sikap)"
    },
    // SKILL (Keterampilan)
    {
      question: "Keterampilan atau kemampuan apa yang paling kamu andalkan dalam pekerjaan sehari-hari?",
      type: "ESSAY",
      category: "SKILL (Keterampilan)"
    },
    {
      question: "Apakah ada hal baru yang kamu pelajari yang meningkatkan kinerja kamu?",
      type: "ESSAY",
      category: "SKILL (Keterampilan)"
    },
    {
      question: "Apa satu keterampilan yang kamu rasa perlu ditingkatkan? Mengapa, dan bagaimana kamu berencana untuk mengembangkan keterampilan tersebut dalam waktu dekat?",
      type: "ESSAY",
      category: "SKILL (Keterampilan)"
    },
    // KNOWLEDGE (Pengetahuan)
    {
      question: "Pengetahuan apa yang kamu rasa paling berharga dan sering kamu terapkan dalam pekerjaan?",
      type: "ESSAY",
      category: "KNOWLEDGE (Pengetahuan)"
    },
    {
      question: "Bagaimana kamu memastikan pengetahuan itu tetap relevan dan terus berkembang?",
      type: "ESSAY",
      category: "KNOWLEDGE (Pengetahuan)"
    },
    {
      question: "Bagaimana kamu mengembangkan pengetahuan kamu dalam pekerjaan?",
      type: "ESSAY",
      category: "KNOWLEDGE (Pengetahuan)"
    },
    {
      question: "Apa saja yang kamu lakukan untuk belajar dan terus memperbarui pengetahuanmu?",
      type: "ESSAY",
      category: "KNOWLEDGE (Pengetahuan)"
    },
    // EXPERIENCE (Pengalaman)
    {
      question: "Pengalaman kerja atau proyek apa yang paling berkesan bagi kamu tahun ini?",
      type: "ESSAY",
      category: "EXPERIENCE (Pengalaman)"
    },
    {
      question: "Apa tantangan yang kamu hadapi dan bagaimana kamu mengatasinya?",
      type: "ESSAY",
      category: "EXPERIENCE (Pengalaman)"
    },
    {
      question: "Apa pelajaran terbesar yang kamu dapatkan dari pengalaman tersebut?",
      type: "ESSAY",
      category: "EXPERIENCE (Pengalaman)"
    },
    {
      question: "Apakah ada perubahan yang kamu buat dalam cara kamu bekerja setelahnya?",
      type: "ESSAY",
      category: "EXPERIENCE (Pengalaman)"
    },
    // RESPONSIBLE (Tanggung Jawab)
    {
      question: "Bagaimana kamu menunjukkan rasa tanggung jawab terhadap pekerjaan dan tugas yang diberikan?",
      type: "ESSAY",
      category: "RESPONSIBLE (Tanggung Jawab)"
    },
    {
      question: "Ceritakan contoh di mana kamu mengambil tanggung jawab lebih dari yang diharapkan.",
      type: "ESSAY",
      category: "RESPONSIBLE (Tanggung Jawab)"
    },
    {
      question: "Dalam situasi di mana tugas atau proyek gagal, bagaimana kamu menghadapinya? Apakah ada perubahan cara kerja yang kamu lakukan setelahnya?",
      type: "ESSAY",
      category: "RESPONSIBLE (Tanggung Jawab)"
    },
    // ACCOUNTABLE (Akuntabilitas)
    {
      question: "Apa sikap atau tindakan yang kamu ambil ketika ada kesalahan dalam pekerjaan yang melibatkan timmu?",
      type: "ESSAY",
      category: "ACCOUNTABLE (Akuntabilitas)"
    },
    {
      question: "Bagaimana kamu memastikan kamu tetap bertanggung jawab atas hasilnya?",
      type: "ESSAY",
      category: "ACCOUNTABLE (Akuntabilitas)"
    },
    {
      question: "Sebutkan keputusan penting yang kamu buat di pekerjaan ini, dan bagaimana kamu memastikan bahwa keputusan tersebut dapat dipertanggungjawabkan baik kepada tim maupun atasan.",
      type: "ESSAY",
      category: "ACCOUNTABLE (Akuntabilitas)"
    },
    // PENILAIAN PENUTUP
    {
      question: "Dari semua yang kamu kerjakan, apa kontribusi atau pencapaian yang paling kamu banggakan selama periode ini?",
      type: "ESSAY",
      category: "PENILAIAN PENUTUP"
    },
    {
      question: "Apa satu area atau kebiasaan dalam pekerjaan yang ingin kamu tingkatkan?",
      type: "ESSAY",
      category: "PENILAIAN PENUTUP"
    },
    {
      question: "Apa langkah pertama yang akan kamu ambil untuk memperbaikinya?",
      type: "ESSAY",
      category: "PENILAIAN PENUTUP"
    },
    {
      question: "Bagaimana kamu ingin berkembang dalam 6–12 bulan ke depan?",
      type: "ESSAY",
      category: "PENILAIAN PENUTUP"
    },
    {
      question: "Apakah tujuan karir atau keterampilan baru yang ingin kamu capai?",
      type: "ESSAY",
      category: "PENILAIAN PENUTUP"
    }
  ];

  const moduleData = {
    title: "Self Assessment 2026",
    description: "Evaluasi Diri Karyawan The Lodge Group",
    type: "SELF_ASSESSMENT",
    category: "General",
    content: "Silakan isi form evaluasi diri berikut dengan jujur dan detail.",
    isMandatory: true,
    version: "1.0"
  };

  // Find existing or create new
  let module = await prisma.learningModule.findFirst({
    where: { 
        type: 'SELF_ASSESSMENT',
        title: moduleData.title
    }
  });

  if (module) {
    console.log('Updating existing module:', module.id);
    module = await prisma.learningModule.update({
        where: { id: module.id },
        data: moduleData
    });
  } else {
    console.log('Creating new module...');
    module = await prisma.learningModule.create({
        data: moduleData
    });
  }

  // Update or Create Quiz
  const existingQuiz = await prisma.quiz.findFirst({
    where: { moduleId: module.id }
  });

  if (existingQuiz) {
    console.log('Updating existing quiz...');
    await prisma.quiz.update({
        where: { id: existingQuiz.id },
        data: { questions: questions }
    });
  } else {
    console.log('Creating new quiz...');
    await prisma.quiz.create({
        data: {
            moduleId: module.id,
            questions: questions,
            minScore: 0 // No score for self assessment
        }
    });
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
