<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kode stabil kontradiksi (mirip `code` pada ambiguity_flags).
     *
     * Tanpa kode stabil, deduplikasi memakai teks requirement yang berubah
     * setiap revisi sehingga kontradiksi yang sama terus muncul sebagai
     * "kontradiksi baru" dan alur tidak pernah selesai.
     */
    public function up(): void
    {
        Schema::table('contradiction_flags', function (Blueprint $table) {
            $table->string('code')->nullable()->after('explanation');
        });
    }

    public function down(): void
    {
        Schema::table('contradiction_flags', function (Blueprint $table) {
            $table->dropColumn('code');
        });
    }
};
