<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Status pemrosesan PRD per proyek (Opsi 3 - queue).
     *
     * Saat user mengirim pesan, penulisan langsung dipindah ke background job
     * agar request HTTP tidak menunggu panggilan AI (yang bisa puluhan detik).
     * Kolom ini dipakai frontend untuk polling hingga draft selesai.
     *   idle       -> tidak ada pekerjaan berjalan
     *   processing -> job sedang menyusun/merevisi PRD
     */
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->string('prd_status')->default('idle')->after('title');
            $table->text('prd_error')->nullable()->after('prd_status');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn(['prd_status', 'prd_error']);
        });
    }
};
